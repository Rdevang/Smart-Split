/**
 * GET /api/upi/[userId]
 * Fetches and decrypts UPI ID for a user
 * 
 * Security: Only returns UPI ID if:
 * 1. User is authenticated
 * 2. Requesting user shares at least one group with the target user
 *    (so they can pay them for group expenses)
 */

import { createRoute, withAuth, ApiResponse, ApiError } from "@/lib/api";
import { decrypt } from "@/lib/encryption";
import { log } from "@/lib/console-logger";

/**
 * Helper to get decrypted UPI ID, handling both encrypted and plain text
 */
function getDecryptedUpiId(storedValue: string | null): string | null {
    if (!storedValue) return null;

    const decrypted = decrypt(storedValue);

    // If decryption returned null and it's not encrypted, return as-is
    if (!decrypted && !storedValue.startsWith("enc:v1:")) {
        return storedValue;
    }

    return decrypted;
}

export const GET = createRoute()
    .use(withAuth())
    .handler(async (ctx) => {
        const targetUserId = ctx.params.userId;

        if (!targetUserId) {
            return ApiError.badRequest("User ID is required");
        }

        // Allow users to fetch their own UPI ID
        if (ctx.user.id === targetUserId) {
            const { data, error } = await ctx.supabase
                .from("profiles")
                .select("upi_id")
                .eq("id", targetUserId)
                .single();

            if (error || !data?.upi_id) {
                return ApiResponse.success({ upi_id: null });
            }

            return ApiResponse.success({ upi_id: getDecryptedUpiId(data.upi_id) });
        }

        // For other users, check if they share a group
        // Get groups where the requesting user is a member
        const { data: requesterGroups } = await ctx.supabase
            .from("group_members")
            .select("group_id")
            .eq("user_id", ctx.user.id);

        if (!requesterGroups || requesterGroups.length === 0) {
            return ApiError.forbidden("You can only view UPI IDs of users in your shared groups");
        }

        const requesterGroupIds = requesterGroups.map(g => g.group_id);

        // Check if target user is in any of those groups
        const { data: sharedMembership } = await ctx.supabase
            .from("group_members")
            .select("group_id")
            .eq("user_id", targetUserId)
            .in("group_id", requesterGroupIds)
            .limit(1);

        if (!sharedMembership || sharedMembership.length === 0) {
            return ApiError.forbidden("You can only view UPI IDs of users in your shared groups");
        }

        // Users share a group - fetch and return UPI ID
        const { data, error } = await ctx.supabase
            .from("profiles")
            .select("upi_id")
            .eq("id", targetUserId)
            .single();

        if (error) {
            return ApiError.notFound("User");
        }

        if (!data?.upi_id) {
            return ApiResponse.success({ upi_id: null });
        }

        // Decrypt UPI ID
        const decryptedUpiId = getDecryptedUpiId(data.upi_id);

        if (!decryptedUpiId && data.upi_id.startsWith("enc:v1:")) {
            log.error("UPI", "Decryption failed for UPI ID");
            return ApiResponse.success({ upi_id: null, error: "Decryption failed" });
        }

        return ApiResponse.success({ upi_id: decryptedUpiId });
    });
