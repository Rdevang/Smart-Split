"use server";

import { revalidatePath } from "next/cache";
import { invalidateGroupCache, invalidateUserCache } from "@/lib/cache";
import { 
    revalidateGroupTags, 
    revalidateExpenseTags, 
    revalidateSettlementTags,
    revalidateMemberTags,
    revalidateUserTags 
} from "@/lib/cache-tags";

// ============================================
// HYBRID CACHE INVALIDATION
// ============================================
// We use BOTH Redis keys AND Next.js tags for maximum coverage:
// - Redis: Fast, distributed, for single-item lookups
// - Next.js Tags: For related lists and aggregates

/**
 * Server action to invalidate cache after group data changes
 * Call this after: expense added/deleted, settlement recorded, member added/removed
 */
export async function invalidateGroupData(groupId: string, userIds?: string[]) {
    // 1. Invalidate Redis cache (for single-item lookups)
    await invalidateGroupCache(groupId);
    
    // 2. Invalidate Next.js cache tags (for lists and related data)
    revalidateGroupTags(groupId, userIds || []);
    
    // 3. Invalidate affected users' dashboard cache
    if (userIds && userIds.length > 0) {
        await Promise.all(userIds.map((id) => invalidateUserCache(id)));
    }
    
    // 4. Revalidate paths (for full page revalidation)
    revalidatePath(`/groups/${groupId}`);
    revalidatePath(`/groups/${groupId}/analytics`);
    revalidatePath("/dashboard");
    revalidatePath("/expenses");
}

/**
 * Server action to invalidate user-related cache
 * Call this after: user joins/leaves group, profile update
 */
export async function invalidateUserData(userId: string) {
    // 1. Invalidate Redis cache
    await invalidateUserCache(userId);
    
    // 2. Invalidate Next.js cache tags
    revalidateUserTags(userId);
    
    // 3. Revalidate paths
    revalidatePath("/dashboard");
    revalidatePath("/groups");
    revalidatePath("/expenses");
}

/**
 * Invalidate all related caches when an expense is added/updated/deleted
 */
export async function onExpenseMutation(
    groupId: string, 
    paidByUserId: string,
    participantIds: string[] = []
) {
    // 1. Redis invalidation
    await invalidateGroupCache(groupId);
    await Promise.all([
        invalidateUserCache(paidByUserId),
        ...participantIds.map((id) => invalidateUserCache(id)),
    ]);
    
    // 2. Tag-based invalidation (handles lists automatically)
    revalidateExpenseTags(groupId, paidByUserId, participantIds);
    
    // 3. Path revalidation
    revalidatePath(`/groups/${groupId}`);
    revalidatePath(`/groups/${groupId}/analytics`);
    revalidatePath("/dashboard");
    revalidatePath("/expenses");
}

/**
 * Invalidate all related caches when a settlement is recorded
 */
export async function onSettlementMutation(
    groupId: string, 
    fromUserId: string, 
    toUserId: string
) {
    // Filter out placeholder IDs
    const isRealUser = (id: string) => id && !id.includes("-placeholder-");
    
    // 1. Redis invalidation
    await invalidateGroupCache(groupId);
    if (isRealUser(fromUserId)) await invalidateUserCache(fromUserId);
    if (isRealUser(toUserId)) await invalidateUserCache(toUserId);
    
    // 2. Tag-based invalidation
    if (isRealUser(fromUserId) && isRealUser(toUserId)) {
        revalidateSettlementTags(groupId, fromUserId, toUserId);
    }
    
    // 3. Path revalidation
    revalidatePath(`/groups/${groupId}`);
    revalidatePath("/dashboard");
}

/**
 * Invalidate caches when a member is added to a group
 */
export async function onMemberAdded(groupId: string, newMemberId?: string) {
    // 1. Redis invalidation
    await invalidateGroupCache(groupId);
    if (newMemberId) {
        await invalidateUserCache(newMemberId);
    }
    
    // 2. Tag-based invalidation
    if (newMemberId) {
        revalidateMemberTags(groupId, newMemberId);
    }
    
    // 3. Path revalidation
    revalidatePath(`/groups/${groupId}`);
    revalidatePath("/groups");
}

/**
 * Invalidate caches when a group is created/updated/deleted
 */
export async function onGroupMutation(groupId: string, creatorId: string) {
    // 1. Redis invalidation
    await invalidateGroupCache(groupId);
    await invalidateUserCache(creatorId);
    
    // 2. Tag-based invalidation
    revalidateGroupTags(groupId, [creatorId]);
    
    // 3. Path revalidation
    revalidatePath("/dashboard");
    revalidatePath("/groups");
    revalidatePath(`/groups/${groupId}`);
}

