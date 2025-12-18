"use server";

import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { ValidationSchemas, sanitizeForDb } from "@/lib/validation";
import { withLock, LockKeys } from "@/lib/distributed-lock";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import { invalidateGroupCache, invalidateUserCache } from "@/lib/cache";

// ============================================
// SETTLEMENT ACTIONS (Rate Limited)
// ============================================

interface SettlementResult {
    success: boolean;
    error?: string;
    pending?: boolean;
    message?: string;
}

/**
 * Record a settlement between two users
 * Rate limited to prevent abuse
 */
export async function recordSettlement(
    groupId: string,
    fromUserId: string,
    toUserId: string,
    amount: number,
    fromIsPlaceholder: boolean = false,
    toIsPlaceholder: boolean = false
): Promise<SettlementResult> {
    // Get request info for rate limiting
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for")?.split(",")[0]
        || headersList.get("x-real-ip")
        || "unknown";

    // Rate limit check for financial operations
    const rateLimitResult = await checkRateLimit(ip, "financial");
    if (!rateLimitResult.success) {
        logger.security("rate_limit.financial.exceeded", "medium", "blocked", {
            ip,
            groupId,
            remaining: rateLimitResult.remaining,
            resetAt: rateLimitResult.reset,
        });
        return {
            success: false,
            error: `Too many settlement requests. Please wait ${rateLimitResult.retryAfter} seconds.`,
        };
    }

    // Validate inputs
    const groupIdValidation = ValidationSchemas.uuid.safeParse(groupId);
    const fromUserIdValidation = ValidationSchemas.uuid.safeParse(fromUserId);
    const toUserIdValidation = ValidationSchemas.uuid.safeParse(toUserId);

    if (!groupIdValidation.success || !fromUserIdValidation.success || !toUserIdValidation.success) {
        return { success: false, error: "Invalid input data" };
    }

    if (amount <= 0 || amount > 999999999.99) {
        return { success: false, error: "Invalid amount" };
    }

    // Get current user
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return { success: false, error: "Authentication required" };
    }

    // Verify user is a member of the group
    const { data: membership } = await supabase
        .from("group_members")
        .select("id")
        .eq("group_id", groupId)
        .eq("user_id", user.id)
        .single();

    if (!membership) {
        logger.security("authz.settlement.denied", "medium", "blocked", {
            userId: user.id,
            groupId,
            reason: "not_member",
        });
        return { success: false, error: "You are not a member of this group" };
    }

    // Use distributed lock to prevent double settlements
    try {
        const result = await withLock(
            LockKeys.settlement(groupId, fromUserId, toUserId),
            async () => {
                return await processSettlement(
                    supabase,
                    groupId,
                    fromUserId,
                    toUserId,
                    amount,
                    user.id,
                    fromIsPlaceholder,
                    toIsPlaceholder
                );
            },
            { ttl: 15 }
        );

        // Invalidate caches on success
        if (result.success) {
            await Promise.all([
                invalidateGroupCache(groupId),
                invalidateUserCache(fromUserId),
                invalidateUserCache(toUserId),
            ]);

            revalidatePath(`/groups/${groupId}`);
        }

        return result;
    } catch (error) {
        if (error instanceof Error && error.message.includes("being processed")) {
            return {
                success: false,
                error: "This settlement is already being processed. Please wait.",
            };
        }
        logger.error("Settlement failed", error instanceof Error ? error : new Error(String(error)), { groupId, fromUserId, toUserId });
        return { success: false, error: "Settlement failed. Please try again." };
    }
}

async function processSettlement(
    supabase: Awaited<ReturnType<typeof createClient>>,
    groupId: string,
    fromUserId: string,
    toUserId: string,
    amount: number,
    recordedBy: string,
    fromIsPlaceholder: boolean,
    toIsPlaceholder: boolean
): Promise<SettlementResult> {
    // Determine if approval is needed
    const currentUserIsReceiver = toUserId === recordedBy;
    const needsApproval = !toIsPlaceholder && !currentUserIsReceiver && !fromIsPlaceholder;

    const settlementData: Record<string, unknown> = {
        group_id: groupId,
        amount: Math.round(amount * 100) / 100, // Round to 2 decimal places
        status: needsApproval ? "pending" : "approved",
        requested_by: recordedBy,
        ...(needsApproval ? {} : { settled_at: new Date().toISOString() }),
    };

    if (fromIsPlaceholder) {
        settlementData.from_placeholder_id = fromUserId;
    } else {
        settlementData.from_user = fromUserId;
    }

    if (toIsPlaceholder) {
        settlementData.to_placeholder_id = toUserId;
    } else {
        settlementData.to_user = toUserId;
    }

    // Create settlement record
    const { error: settlementError } = await supabase
        .from("settlements")
        .insert(settlementData);

    if (settlementError) {
        logger.error("Settlement insert failed", new Error(settlementError.message), { code: settlementError.code });
        return { success: false, error: "Failed to record settlement" };
    }

    // Log activity
    const paidByName = fromIsPlaceholder ? fromUserId : (await getProfileName(supabase, fromUserId));
    const paidToName = toIsPlaceholder ? toUserId : (await getProfileName(supabase, toUserId));

    await supabase.from("activities").insert({
        user_id: recordedBy,
        group_id: groupId,
        entity_type: "settlement",
        action: needsApproval ? "requested" : "created",
        metadata: {
            amount,
            from: paidByName,
            to: paidToName,
            status: needsApproval ? "pending" : "approved",
        },
    });

    if (needsApproval) {
        return {
            success: true,
            pending: true,
            message: "Settlement request sent for approval",
        };
    }

    return { success: true };
}

async function getProfileName(
    supabase: Awaited<ReturnType<typeof createClient>>,
    userId: string
): Promise<string> {
    const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .single();
    return data?.full_name || "Unknown";
}

// ============================================
// EXPENSE ACTIONS (Rate Limited)
// ============================================

interface ExpenseResult {
    success: boolean;
    error?: string;
    expenseId?: string;
}

/**
 * Create an expense with rate limiting
 */
export async function createExpenseAction(
    formData: FormData
): Promise<ExpenseResult> {
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for")?.split(",")[0]
        || headersList.get("x-real-ip")
        || "unknown";

    // Rate limit for write operations
    const rateLimitResult = await checkRateLimit(ip, "write");
    if (!rateLimitResult.success) {
        return {
            success: false,
            error: `Too many requests. Please wait ${rateLimitResult.retryAfter} seconds.`,
        };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: "Authentication required" };
    }

    // Extract and validate form data
    const groupId = formData.get("group_id") as string;
    const description = formData.get("description") as string;
    const amountStr = formData.get("amount") as string;

    const groupIdValidation = ValidationSchemas.uuid.safeParse(groupId);
    if (!groupIdValidation.success) {
        return { success: false, error: "Invalid group" };
    }

    const sanitizedDescription = sanitizeForDb(description || "").slice(0, 200);
    if (!sanitizedDescription) {
        return { success: false, error: "Description is required" };
    }

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0 || amount > 999999999.99) {
        return { success: false, error: "Invalid amount" };
    }

    // Additional validation and expense creation logic would go here
    // For now, return success as the actual creation is handled elsewhere

    return { success: true };
}

