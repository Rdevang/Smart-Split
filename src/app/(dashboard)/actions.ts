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
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/currency";

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

/**
 * Invalidate all related caches when bulk expenses are added
 * Optimized for multiple expenses at once - batches Redis operations
 */
export async function onBulkExpenseMutation(
    groupId: string,
    payerIds: string[],
    allParticipantIds: string[]
) {
    // Deduplicate all user IDs
    const allUserIds = [...new Set([...payerIds, ...allParticipantIds])];

    // 1. Redis invalidation - batch all user cache invalidations
    await Promise.all([
        invalidateGroupCache(groupId),
        ...allUserIds.map((id) => invalidateUserCache(id)),
    ]);

    // 2. Tag-based invalidation for each payer
    // This handles expense lists and balance updates
    for (const payerId of payerIds) {
        revalidateExpenseTags(groupId, payerId, allParticipantIds);
    }

    // 3. Path revalidation
    revalidatePath(`/groups/${groupId}`);
    revalidatePath(`/groups/${groupId}/analytics`);
    revalidatePath("/dashboard");
    revalidatePath("/expenses");
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
 * Sends both in-app notification AND email (if configured)
 * 
 * NOTE: Email sending is completely non-blocking and fire-and-forget.
 * Even if email limits are reached or email fails, this action succeeds.
 */
export async function sendPaymentReminder(
    groupId: string,
    debtorUserId: string,
    creditorUserId: string,
    amount: number,
    currencyCode: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    // Get the creditor's name and debtor's info
    const [{ data: creditor }, { data: debtor }, { data: group }] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", creditorUserId).single(),
        supabase.from("profiles").select("full_name, email").eq("id", debtorUserId).single(),
        supabase.from("groups").select("name").eq("id", groupId).single(),
    ]);

    const creditorName = creditor?.full_name || "Someone";
    const debtorName = debtor?.full_name || "there";
    const debtorEmail = debtor?.email;
    const groupName = group?.name || "a group";
    const formattedAmount = formatCurrency(amount, currencyCode);

    // Create the in-app notification (this is the primary notification)
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
                currency: currencyCode,
            },
            action_url: `/groups/${groupId}`,
        });

    if (error) {
        console.error("Failed to send reminder:", error);
        return { success: false, error: "Failed to send reminder" };
    }

    // Email notification is completely non-blocking (fire-and-forget)
    // This runs in background and doesn't affect the main action
    if (debtorEmail) {
        // Import and call async - don't await, let it run in background
        import("@/lib/notifications").then(({ notifyPaymentReminder }) => {
            const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://smartsplit.app";
            notifyPaymentReminder({
                userId: debtorUserId,
                email: debtorEmail,
                debtorName: debtorName,
                creditorName: creditorName,
                amount: formattedAmount,
                groupName: groupName,
                paymentLink: `${siteUrl}/groups/${encryptUrlId(groupId)}`,
            });
        }).catch(() => {
            // Silently ignore import errors - email is supplementary
        });
    }

    // Log activity (non-blocking - wrap in try-catch to handle async)
    (async () => {
        try {
            await supabase.from("activities").insert({
                group_id: groupId,
                user_id: creditorUserId,
                entity_type: "settlement",
                entity_id: null,
                action: "reminded",
                metadata: {
                    debtor_id: debtorUserId,
                    amount: amount,
                    currency: currencyCode,
                },
            });
        } catch { /* ignore activity logging errors */ }
    })();

    return { success: true };
}
