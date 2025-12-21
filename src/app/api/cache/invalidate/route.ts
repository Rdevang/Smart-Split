import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { invalidateGroupCache } from "@/lib/cache";

/**
 * POST /api/cache/invalidate
 * Invalidate cache for a specific group
 * Body: { groupId: string }
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { groupId } = body;

        if (!groupId) {
            return NextResponse.json({ error: "groupId is required" }, { status: 400 });
        }

        // Verify user is a member of this group
        const { data: membership } = await supabase
            .from("group_members")
            .select("id")
            .eq("group_id", groupId)
            .eq("user_id", user.id)
            .single();

        if (!membership) {
            return NextResponse.json({ error: "Not a member of this group" }, { status: 403 });
        }

        // Invalidate the group cache
        await invalidateGroupCache(groupId);

        return NextResponse.json({ success: true, message: "Cache invalidated" });
    } catch (err) {
        console.error("Cache invalidation error:", err);
        return NextResponse.json({ error: "Failed to invalidate cache" }, { status: 500 });
    }
}

