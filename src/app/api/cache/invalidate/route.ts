/**
 * POST /api/cache/invalidate
 * 
 * Invalidate cache for a specific group.
 * Requires authentication and group membership.
 */

import { z } from "zod";
import { createRoute, withAuth, withValidation, withGroupMembership, ApiResponse } from "@/lib/api";
import { invalidateGroupCache } from "@/lib/cache";

const InvalidateCacheSchema = z.object({
    groupId: z.string().uuid("Invalid group ID"),
});

export const POST = createRoute()
    .use(withAuth())
    .use(withValidation(InvalidateCacheSchema))
    .use(withGroupMembership("groupId", { allowBodyGroupId: true }))
    .handler(async (ctx) => {
        // Invalidate the group cache
        await invalidateGroupCache(ctx.groupId);

        return ApiResponse.success({ 
            success: true, 
            message: "Cache invalidated" 
        });
    });
