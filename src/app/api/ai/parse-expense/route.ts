import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseExpenseFromText, suggestCategory } from "@/services/ai";
import { checkAIUsage, incrementAIUsage } from "@/lib/ai-rate-limit";

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Verify user is authenticated
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Check AI usage limit (1 per day per user)
        const usage = await checkAIUsage(user.id);
        if (!usage.allowed) {
            const hoursUntilReset = Math.ceil((usage.resetAt.getTime() - Date.now()) / (1000 * 60 * 60));
            return NextResponse.json(
                { 
                    error: `Daily AI limit reached (${usage.limit}/day). Resets in ${hoursUntilReset} hours.`,
                    limitReached: true,
                    usage: {
                        used: usage.used,
                        limit: usage.limit,
                        resetAt: usage.resetAt.toISOString(),
                    }
                },
                { status: 429 }
            );
        }

        const body = await request.json();
        const { text, groupId } = body;

        if (!text || typeof text !== "string") {
            return NextResponse.json(
                { error: "Text is required" },
                { status: 400 }
            );
        }

        // Get group members if groupId provided
        let groupMembers: string[] = [];
        if (groupId) {
            const { data: members } = await supabase
                .from("group_members")
                .select(`
                    user_id,
                    placeholder_id,
                    profiles!group_members_user_id_fkey(full_name),
                    placeholder_members(name)
                `)
                .eq("group_id", groupId);

            if (members) {
                groupMembers = members
                    .map((m) => {
                        // Handle Supabase join return types
                        const profile = m.profiles as unknown as { full_name: string | null } | null;
                        const placeholder = m.placeholder_members as unknown as { name: string } | null;
                        return profile?.full_name || placeholder?.name || null;
                    })
                    .filter((name): name is string => name !== null);
            }
        }

        // Parse the expense text
        const parsedExpense = await parseExpenseFromText(text, groupMembers);

        // Increment usage count after successful parse
        await incrementAIUsage(user.id);

        // Get updated usage for response
        const updatedUsage = await checkAIUsage(user.id);

        return NextResponse.json({
            success: true,
            expense: parsedExpense,
            usage: {
                used: updatedUsage.used,
                limit: updatedUsage.limit,
                remaining: updatedUsage.remaining,
                resetAt: updatedUsage.resetAt.toISOString(),
            }
        });
    } catch (error) {
        console.error("[AI Parse Expense] Error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json(
            { error: `Failed to parse expense: ${errorMessage}` },
            { status: 500 }
        );
    }
}

// Endpoint to check AI usage or suggest category
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Verify user is authenticated
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const action = request.nextUrl.searchParams.get("action");

        // Check usage endpoint
        if (action === "check-usage") {
            const usage = await checkAIUsage(user.id);
            return NextResponse.json({
                success: true,
                usage: {
                    used: usage.used,
                    limit: usage.limit,
                    remaining: usage.remaining,
                    allowed: usage.allowed,
                    resetAt: usage.resetAt.toISOString(),
                }
            });
        }

        // Category suggestion endpoint
        const description = request.nextUrl.searchParams.get("description");

        if (!description) {
            return NextResponse.json(
                { error: "Description is required" },
                { status: 400 }
            );
        }

        const category = await suggestCategory(description);

        return NextResponse.json({
            success: true,
            category,
        });
    } catch (error) {
        console.error("[AI] Error:", error);
        return NextResponse.json(
            { error: "Failed to process request" },
            { status: 500 }
        );
    }
}

