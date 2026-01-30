import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { invalidateGroupCache } from "@/lib/cache";
import { ApiResponse, ApiError, withErrorHandler } from "@/lib/api-responses";

/**
 * POST /api/cache/invalidate
 * Invalidate cache for a specific group
 * Body: { groupId: string }
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        return ApiError.unauthorized();
    }

    const body = await request.json();
    const { groupId } = body;

    if (!groupId) {
        return ApiError.badRequest("groupId is required");
    }

    // Verify user is a member of this group
    const { data: membership } = await supabase
        .from("group_members")
        .select("id")
        .eq("group_id", groupId)
        .eq("user_id", user.id)
        .single();

    if (!membership) {
        return ApiError.forbidden("Not a member of this group");
    }

    // Invalidate the group cache
    await invalidateGroupCache(groupId);

    return ApiResponse.success({ success: true, message: "Cache invalidated" });
});
