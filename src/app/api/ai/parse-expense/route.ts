import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseExpenseFromText, suggestCategory } from "@/services/ai";

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Verify user is authenticated
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

        return NextResponse.json({
            success: true,
            expense: parsedExpense,
        });
    } catch (error) {
        console.error("[AI Parse Expense] Error:", error);
        return NextResponse.json(
            { error: "Failed to parse expense" },
            { status: 500 }
        );
    }
}

// Endpoint to just get category suggestion
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Verify user is authenticated
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

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
        console.error("[AI Suggest Category] Error:", error);
        return NextResponse.json(
            { error: "Failed to suggest category" },
            { status: 500 }
        );
    }
}

