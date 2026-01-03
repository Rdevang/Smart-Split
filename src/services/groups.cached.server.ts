/**
 * Cached version of groups server service
 * 
 * CACHING STRATEGY:
 * - Redis (via cached()): For expensive queries with automatic compression
 * - Tag-based invalidation via revalidateTag() in actions.ts
 * 
 * NOTE: We cannot use unstable_cache() here because it cannot contain
 * dynamic functions like cookies() which Supabase server client requires.
 */

import { cached, cachedCoalesced, CacheKeys, CacheTTL, invalidateGroupCache, invalidateUserCache } from "@/lib/cache";
import { groupsServerService, type GroupWithMembers, type GroupBalance, type PaginatedResult, type PaginationParams } from "./groups.server";

export const groupsCachedServerService = {
    /**
     * Get groups for a user (cached for 5 minutes)
     * Uses REQUEST COALESCING - high traffic endpoint
     * Cache key: user:{userId}:groups
     */
    async getGroups(
        userId: string,
        params: PaginationParams = {}
    ): Promise<PaginatedResult<GroupWithMembers>> {
        // Don't cache paginated results beyond page 1 (too many variants)
        if (params.page && params.page > 1) {
            return groupsServerService.getGroups(userId, params);
        }

        return cachedCoalesced(
            CacheKeys.userGroups(userId),
            () => groupsServerService.getGroups(userId, params),
            CacheTTL.MEDIUM // 5 minutes
        );
    },

    /**
     * Get single group with members (cached for 5 minutes)
     * Uses REQUEST COALESCING - high traffic endpoint
     * Cache key: group:{groupId}:details
     */
    async getGroup(groupId: string): Promise<GroupWithMembers | null> {
        return cachedCoalesced(
            CacheKeys.groupDetails(groupId),
            () => groupsServerService.getGroup(groupId),
            CacheTTL.MEDIUM // 5 minutes
        );
    },

    /**
     * Get group balances (cached for 30 minutes - expensive computation)
     * This is the MOST expensive query - calls get_group_balances RPC
     * Uses REQUEST COALESCING - prevents DB stampede on cold start
     * Cache key: group:{groupId}:balances
     */
    async getGroupBalances(groupId: string): Promise<GroupBalance[]> {
        return cachedCoalesced(
            CacheKeys.groupBalances(groupId),
            () => groupsServerService.getGroupBalances(groupId),
            CacheTTL.VERY_LONG // 30 minutes - balances are expensive to compute
        );
    },

    /**
     * Check if user is admin (cached for 15 minutes)
     * Uses indexed RPC function internally
     */
    async isUserAdmin(groupId: string, userId: string): Promise<boolean> {
        const cacheKey = `group:${groupId}:admin:${userId}`;
        return cached(
            cacheKey,
            () => groupsServerService.isUserAdmin(groupId, userId),
            CacheTTL.LONG // 15 minutes - role rarely changes
        );
    },

    /**
     * Check if user is member (cached for 15 minutes)
     */
    async isUserMember(groupId: string, userId: string): Promise<boolean> {
        const cacheKey = `group:${groupId}:member:${userId}`;
        return cached(
            cacheKey,
            () => groupsServerService.isUserMember(groupId, userId),
            CacheTTL.LONG // 15 minutes
        );
    },

    /**
     * Get group count for user (cached for 5 minutes)
     */
    async getGroupCount(userId: string): Promise<number> {
        const cacheKey = `user:${userId}:group_count`;
        return cached(
            cacheKey,
            () => groupsServerService.getGroupCount(userId),
            CacheTTL.MEDIUM // 5 minutes
        );
    },

    /**
     * Get group by invite code (NOT cached - security sensitive)
     */
    async getGroupByInviteCode(code: string) {
        // Don't cache invite code lookups - they should always hit DB for security
        return groupsServerService.getGroupByInviteCode(code);
    },

    /**
     * Check if user is already in group (NOT cached - needs real-time accuracy)
     */
    async isUserInGroup(groupId: string, userId: string): Promise<boolean> {
        return groupsServerService.isUserInGroup(groupId, userId);
    },

    /**
     * Get settlements with names (cached for 5 minutes)
     * Cache key: group:{groupId}:settlements
     */
    async getSettlementsWithNames(groupId: string) {
        const cacheKey = `group:${groupId}:settlements`;
        return cached(
            cacheKey,
            () => groupsServerService.getSettlementsWithNames(groupId),
            CacheTTL.MEDIUM // 5 minutes
        );
    },

    // ============================================
    // CACHE INVALIDATION HELPERS
    // Call these after mutations
    // ============================================

    /**
     * Invalidate all group-related cache when:
     * - Expense added/deleted/updated
     * - Settlement recorded
     * - Member added/removed
     */
    async invalidateGroup(groupId: string): Promise<void> {
        await invalidateGroupCache(groupId);
    },

    /**
     * Invalidate user-related cache when:
     * - User joins/leaves group
     * - User's expenses change
     */
    async invalidateUser(userId: string): Promise<void> {
        await invalidateUserCache(userId);
    },

    /**
     * Invalidate both group and affected users when:
     * - Expense added (affects group balances + all member dashboards)
     * - Settlement recorded
     */
    async invalidateGroupAndMembers(groupId: string, memberIds: string[]): Promise<void> {
        await Promise.all([
            invalidateGroupCache(groupId),
            ...memberIds.map((id) => invalidateUserCache(id)),
        ]);
    },
};

// Re-export types for convenience
export type { GroupWithMembers, GroupBalance, PaginatedResult, PaginationParams } from "./groups.server";
