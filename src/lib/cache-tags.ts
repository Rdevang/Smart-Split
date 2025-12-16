import { revalidateTag as nextRevalidateTag } from "next/cache";

// ============================================
// CACHE TAGS - Semantic grouping of cached data
// ============================================
// Tags allow invalidating related data together
// e.g., updating a group invalidates both the group detail AND the groups list
//
// NOTE: We use revalidateTag() for invalidation only, NOT unstable_cache()
// because unstable_cache() cannot contain dynamic functions like cookies()
// which our Supabase server client requires.

export const CacheTags = {
    // User-related tags
    user: (userId: string) => `user:${userId}`,
    userGroups: (userId: string) => `user:${userId}:groups`,
    userExpenses: (userId: string) => `user:${userId}:expenses`,
    userBalances: (userId: string) => `user:${userId}:balances`,
    userFriends: (userId: string) => `user:${userId}:friends`,
    userActivity: (userId: string) => `user:${userId}:activity`,

    // Group-related tags
    group: (groupId: string) => `group:${groupId}`,
    groupMembers: (groupId: string) => `group:${groupId}:members`,
    groupExpenses: (groupId: string) => `group:${groupId}:expenses`,
    groupBalances: (groupId: string) => `group:${groupId}:balances`,
    groupSettlements: (groupId: string) => `group:${groupId}:settlements`,
    groupAnalytics: (groupId: string) => `group:${groupId}:analytics`,

    // Global tags (lists, aggregates)
    allGroups: "all-groups",
    allExpenses: "all-expenses",
    recentActivity: "recent-activity",
    dashboard: "dashboard",
} as const;

// ============================================
// CACHE PROFILE
// ============================================
// Next.js 16 requires a cache profile as the second argument
// "max" = Maximum revalidation (stale-while-revalidate)

const CACHE_PROFILE = "max";

/**
 * Wrapper around Next.js revalidateTag with default profile
 */
function revalidateTag(tag: string): void {
    nextRevalidateTag(tag, CACHE_PROFILE);
}

// ============================================
// REVALIDATION HELPERS
// ============================================
// These functions invalidate related data together
// Call them from server actions after mutations

/**
 * Invalidate all cache tags related to a group
 * Call this when: creating/updating/deleting a group
 */
export function revalidateGroupTags(groupId: string, memberIds: string[] = []) {
    // Invalidate the specific group
    revalidateTag(CacheTags.group(groupId));
    revalidateTag(CacheTags.groupMembers(groupId));
    revalidateTag(CacheTags.groupExpenses(groupId));
    revalidateTag(CacheTags.groupBalances(groupId));
    revalidateTag(CacheTags.groupSettlements(groupId));
    revalidateTag(CacheTags.groupAnalytics(groupId));

    // Invalidate all groups list
    revalidateTag(CacheTags.allGroups);
    revalidateTag(CacheTags.dashboard);

    // Invalidate each member's group list
    memberIds.forEach((userId) => {
        revalidateTag(CacheTags.userGroups(userId));
        revalidateTag(CacheTags.userBalances(userId));
    });
}

/**
 * Invalidate all cache tags related to an expense
 * Call this when: creating/updating/deleting an expense
 */
export function revalidateExpenseTags(
    groupId: string,
    paidByUserId: string,
    participantIds: string[] = []
) {
    // Invalidate group-level caches
    revalidateTag(CacheTags.groupExpenses(groupId));
    revalidateTag(CacheTags.groupBalances(groupId));
    revalidateTag(CacheTags.groupAnalytics(groupId));

    // Invalidate all expenses list
    revalidateTag(CacheTags.allExpenses);
    revalidateTag(CacheTags.dashboard);

    // Invalidate payer's expenses
    revalidateTag(CacheTags.userExpenses(paidByUserId));
    revalidateTag(CacheTags.userBalances(paidByUserId));

    // Invalidate each participant's caches
    participantIds.forEach((userId) => {
        revalidateTag(CacheTags.userExpenses(userId));
        revalidateTag(CacheTags.userBalances(userId));
    });
}

/**
 * Invalidate all cache tags related to a settlement
 * Call this when: recording a settlement
 */
export function revalidateSettlementTags(
    groupId: string,
    fromUserId: string,
    toUserId: string
) {
    // Invalidate group-level caches
    revalidateTag(CacheTags.groupBalances(groupId));
    revalidateTag(CacheTags.groupSettlements(groupId));
    revalidateTag(CacheTags.groupAnalytics(groupId));

    // Invalidate both users' balances
    revalidateTag(CacheTags.userBalances(fromUserId));
    revalidateTag(CacheTags.userBalances(toUserId));

    // Invalidate dashboard
    revalidateTag(CacheTags.dashboard);
}

/**
 * Invalidate all cache tags related to a member change
 * Call this when: adding/removing a member from a group
 */
export function revalidateMemberTags(groupId: string, userId: string) {
    revalidateTag(CacheTags.group(groupId));
    revalidateTag(CacheTags.groupMembers(groupId));
    revalidateTag(CacheTags.groupBalances(groupId));
    revalidateTag(CacheTags.userGroups(userId));
    revalidateTag(CacheTags.allGroups);
}

/**
 * Invalidate all cache tags for a user
 * Call this when: user profile update, user deletion
 */
export function revalidateUserTags(userId: string) {
    revalidateTag(CacheTags.user(userId));
    revalidateTag(CacheTags.userGroups(userId));
    revalidateTag(CacheTags.userExpenses(userId));
    revalidateTag(CacheTags.userBalances(userId));
    revalidateTag(CacheTags.userFriends(userId));
    revalidateTag(CacheTags.userActivity(userId));
}

// ============================================
// CACHING STRATEGY
// ============================================
// 
// We use Redis for caching (via cached() in cache.ts):
// - Fast, distributed cache with compression
// - Supports SWR (stale-while-revalidate)
// - Circuit breaker for graceful degradation
// - Stampede protection with locks
// 
// We use Next.js revalidateTag() for invalidation:
// - Semantic grouping of related data
// - One call invalidates multiple related caches
// - Works alongside Redis cache invalidation
// 
// Why NOT unstable_cache():
// - Cannot use with dynamic functions (cookies, headers)
// - Our Supabase server client requires cookies()
// - Use Redis caching instead for server components
