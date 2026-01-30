/**
 * POST /api/cache/invalidate
 * 
 * Invalidate cache for a specific group.
 * Requires authentication and group membership.
 */

import { z } from "zod";
import { createRoute, withAuth, withValidation, ApiResponse, ApiError, type AuthContext, type ValidatedContext } from "@/lib/api";
import { invalidateGroupCache } from "@/lib/cache";

const InvalidateCacheSchema = z.object({
    groupId: z.string().uuid("Invalid group ID"),
});

type InvalidateCacheContext = AuthContext & ValidatedContext<z.infer<typeof InvalidateCacheSchema>>;

export const POST = createRoute()
    .use(withAuth())
    .use(withValidation(InvalidateCacheSchema))
    .handler(async (ctx) => {
        const { validated, supabase, user } = ctx as unknown as InvalidateCacheContext;
        const { groupId } = validated;

        // Verify user is member of the group
        const { data: membership, error } = await supabase
            .from("group_members")
            .select("id")
            .eq("group_id", groupId)
            .eq("user_id", user.id)
            .single();

        if (error || !membership) {
            return ApiError.forbidden("Not a member of this group");
        }

        // Invalidate the group cache
        await invalidateGroupCache(groupId);

        return ApiResponse.success({ 
            success: true, 
            message: "Cache invalidated" 
        });
    });
