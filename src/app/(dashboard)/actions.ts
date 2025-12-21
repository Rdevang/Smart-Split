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
import { encryptUrlId } from "@/lib/url-ids";

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
    // 1. Redis invalidation - MUST complete before path revalidation
    await invalidateGroupCache(groupId);
    if (newMemberId) {
        await invalidateUserCache(newMemberId);
    }

    // 2. Tag-based invalidation
    if (newMemberId) {
        revalidateMemberTags(groupId, newMemberId);
    }

    // 3. Path revalidation - this triggers Next.js to refetch server components
    revalidatePath(`/groups/${groupId}`, "page");
    revalidatePath(`/groups`, "page");
    revalidatePath(`/dashboard`, "page");
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

// ============================================
// URL ID ENCRYPTION (Server-side only)
// ============================================
// Encryption uses Node.js crypto which only works on server
// Client components call this action to get encrypted URLs

/**
 * Server action to encrypt a URL ID
 * Use this from client components that need encrypted URLs for navigation
 */
export async function getEncryptedUrl(path: string, id: string): Promise<string> {
    const encryptedId = encryptUrlId(id);
    return path.replace("[id]", encryptedId);
}

/**
 * Server action to get encrypted group URL
 */
export async function getEncryptedGroupUrl(groupId: string): Promise<string> {
    return `/groups/${encryptUrlId(groupId)}`;
}

// ============================================
// PAYMENT REMINDERS
// ============================================

/**
 * Server action to send a payment reminder notification
 */
export async function sendPaymentReminder(
    groupId: string,
    debtorUserId: string,
    creditorUserId: string,
    amount: number,
    currency: string
): Promise<{ success: boolean; error?: string }> {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    // Get the creditor's name
    const { data: creditor } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", creditorUserId)
        .single();

    // Get the group name
    const { data: group } = await supabase
        .from("groups")
        .select("name")
        .eq("id", groupId)
        .single();

    const creditorName = creditor?.full_name || "Someone";
    const groupName = group?.name || "a group";

    // Format amount with currency
    const { formatCurrency } = await import("@/lib/currency");
    const formattedAmount = formatCurrency(amount, currency);

    // Create the notification
    const { error } = await supabase
        .from("notifications")
        .insert({
            user_id: debtorUserId,
            type: "payment_reminder",
            title: "💸 Payment Reminder",
            message: `${creditorName} is requesting ${formattedAmount} in ${groupName}`,
            data: {
                group_id: groupId,
                creditor_id: creditorUserId,
                amount: amount,
                currency: currency,
            },
            action_url: `/groups/${encryptUrlId(groupId)}`,
        });

    if (error) {
        console.error("Failed to send reminder:", error);
        return { success: false, error: "Failed to send reminder" };
    }

    // Log activity
    await supabase.from("activities").insert({
        group_id: groupId,
        user_id: creditorUserId,
        entity_type: "settlement",
        entity_id: null,
        action: "reminded",
        metadata: {
            debtor_id: debtorUserId,
            amount: amount,
            currency: currency,
        },
    });

    return { success: true };
}
