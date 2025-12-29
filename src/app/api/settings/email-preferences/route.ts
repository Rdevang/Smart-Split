import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Verify user is authenticated
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { userId, preferences } = body;

        // Use authenticated user's ID if "current" is passed
        const targetUserId = userId === "current" ? user.id : userId;

        // Verify user can only update their own preferences
        if (targetUserId !== user.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Validate preferences structure
        const validKeys = [
            "payment_reminders",
            "settlement_requests",
            "settlement_updates",
            "group_invitations",
            "expense_added",
            "weekly_digest",
        ];

        const sanitizedPreferences: Record<string, boolean> = {};
        for (const key of validKeys) {
            sanitizedPreferences[key] = Boolean(preferences[key]);
        }

        // Update preferences
        const { error: updateError } = await supabase
            .from("profiles")
            .update({ email_preferences: sanitizedPreferences })
            .eq("id", targetUserId);

        if (updateError) {
            console.error("[EmailPreferences] Update failed:", updateError);
            return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[EmailPreferences] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function GET() {
    try {
        const supabase = await createClient();

        // Verify user is authenticated
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get user's email preferences
        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("email_preferences")
            .eq("id", user.id)
            .single();

        if (profileError) {
            console.error("[EmailPreferences] Fetch failed:", profileError);
            return NextResponse.json({ error: "Failed to fetch preferences" }, { status: 500 });
        }

        // Default preferences if not set
        const defaultPreferences = {
            payment_reminders: true,
            settlement_requests: true,
            settlement_updates: true,
            group_invitations: true,
            expense_added: false,
            weekly_digest: true,
        };

        return NextResponse.json({
            preferences: profile?.email_preferences || defaultPreferences,
        });
    } catch (error) {
        console.error("[EmailPreferences] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

