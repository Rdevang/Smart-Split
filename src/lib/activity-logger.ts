/**
 * Centralized Activity Logger
 * 
 * This module provides a single, consistent way to log activities
 * across all services. It ensures:
 * - Consistent activity format
 * - Proper error handling (fire-and-forget)
 * - Type-safe activity types
 * - Easy tracking of activity usage
 * 
 * USAGE:
 *   import { logActivity, ActivityTypes } from "@/lib/activity-logger";
 *   
 *   await logActivity(supabase, {
 *       userId: "user-uuid",
 *       groupId: "group-uuid",
 *       action: ActivityTypes.EXPENSE_CREATED,
 *       details: { amount: 100, description: "Lunch" },
 *   });
 */

import { dbLog } from "./console-logger";
import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================
// ACTIVITY TYPES (for consistency)
// ============================================

export const ActivityTypes = {
    // Group activities
    GROUP_CREATED: "created_group",
    GROUP_UPDATED: "updated_group",
    GROUP_DELETED: "deleted_group",
    GROUP_RESTORED: "restored_group",
    GROUP_JOINED: "joined_group",

    // Member activities
    MEMBER_ADDED: "added_member",
    MEMBER_REMOVED: "removed_member",
    PLACEHOLDER_ADDED: "added_placeholder_member",
    PLACEHOLDER_REMOVED: "removed_placeholder_member",

    // Expense activities
    EXPENSE_CREATED: "created_expense",
    EXPENSE_UPDATED: "updated_expense",
    EXPENSE_DELETED: "deleted_expense",
    EXPENSES_BULK_CREATED: "bulk_created_expenses",

    // Settlement activities
    SETTLEMENT_RECORDED: "recorded_settlement",
    SETTLEMENT_REQUESTED: "settlement_requested",
    SETTLEMENT_APPROVED: "settlement_approved",
    SETTLEMENT_REJECTED: "settlement_rejected",
    SPLIT_SETTLED: "settled_split",

    // Invitation activities
    INVITATION_SENT: "sent_invitation",
    INVITATION_ACCEPTED: "accepted_invitation",
    INVITATION_DECLINED: "declined_invitation",
} as const;

export type ActivityType = (typeof ActivityTypes)[keyof typeof ActivityTypes];

// ============================================
// ACTIVITY INPUT INTERFACE
// ============================================

export interface ActivityInput {
    /** User performing the action */
    userId: string;
    /** Group where the action occurred */
    groupId: string;
    /** Type of activity */
    action: ActivityType | string;
    /** Human-readable details about the action */
    details?: Record<string, unknown>;
    /** Additional metadata (IDs, timestamps, etc.) */
    metadata?: Record<string, unknown>;
}

export interface BulkActivityInput {
    /** User performing the action */
    userId: string;
    /** Group where the action occurred */
    groupId: string;
    /** Array of activity objects */
    activities: Array<{
        action: ActivityType | string;
        details?: Record<string, unknown>;
        metadata?: Record<string, unknown>;
    }>;
}

// ============================================
// CORE LOGGING FUNCTIONS
// ============================================

/**
 * Log a single activity
 * 
 * This function is fire-and-forget - it doesn't throw errors
 * to prevent activity logging from blocking the main operation.
 * 
 * @param supabase - Supabase client
 * @param input - Activity data
 * @returns Promise that resolves when logging completes (or fails silently)
 */
export async function logActivity(
    supabase: SupabaseClient,
    input: ActivityInput
): Promise<void> {
    try {
        await supabase.from("activities").insert({
            user_id: input.userId,
            group_id: input.groupId,
            action: input.action,
            details: input.details || null,
            metadata: input.metadata || null,
        });
    } catch (error) {
        // Fire-and-forget: Log error but don't throw
        dbLog.error("Failed to log activity", {
            action: input.action,
            error: error instanceof Error ? error.message : String(error),
        });
    }
}

/**
 * Log multiple activities at once
 * 
 * Useful for bulk operations that create multiple activities.
 * Fire-and-forget - doesn't throw errors.
 * 
 * @param supabase - Supabase client
 * @param input - Bulk activity data
 * @returns Promise that resolves when logging completes (or fails silently)
 */
export async function logActivities(
    supabase: SupabaseClient,
    input: BulkActivityInput
): Promise<void> {
    try {
        const rows = input.activities.map((act) => ({
            user_id: input.userId,
            group_id: input.groupId,
            action: act.action,
            details: act.details || null,
            metadata: act.metadata || null,
        }));

        await supabase.from("activities").insert(rows);
    } catch (error) {
        // Fire-and-forget: Log error but don't throw
        dbLog.error("Failed to log bulk activities", {
            count: input.activities.length,
            error: error instanceof Error ? error.message : String(error),
        });
    }
}

/**
 * Log activity in the background (truly fire-and-forget)
 * 
 * Use this when you don't want to wait for the activity to be logged.
 * The promise resolves immediately, and logging happens in the background.
 * 
 * @param supabase - Supabase client
 * @param input - Activity data
 */
export function logActivityBackground(
    supabase: SupabaseClient,
    input: ActivityInput
): void {
    // Execute in background without awaiting
    logActivity(supabase, input).catch(() => {
        // Already logged in logActivity, nothing more to do
    });
}

/**
 * Log bulk activities in the background (truly fire-and-forget)
 * 
 * @param supabase - Supabase client
 * @param input - Bulk activity data
 */
export function logActivitiesBackground(
    supabase: SupabaseClient,
    input: BulkActivityInput
): void {
    // Execute in background without awaiting
    logActivities(supabase, input).catch(() => {
        // Already logged in logActivities, nothing more to do
    });
}

// ============================================
// HELPER FACTORIES FOR COMMON ACTIVITIES
// ============================================

/**
 * Create activity input for expense creation
 */
export function expenseCreatedActivity(
    userId: string,
    groupId: string,
    expense: { id: string; description: string; amount: number }
): ActivityInput {
    return {
        userId,
        groupId,
        action: ActivityTypes.EXPENSE_CREATED,
        details: { expense_description: expense.description },
        metadata: { expense_id: expense.id, amount: expense.amount },
    };
}

/**
 * Create activity input for settlement
 */
export function settlementActivity(
    userId: string,
    groupId: string,
    settlement: {
        id: string;
        fromName: string;
        toName: string;
        amount: number;
        currency: string;
    }
): ActivityInput {
    return {
        userId,
        groupId,
        action: ActivityTypes.SETTLEMENT_RECORDED,
        details: {
            from_name: settlement.fromName,
            to_name: settlement.toName,
            amount: settlement.amount,
            currency: settlement.currency,
        },
        metadata: { settlement_id: settlement.id },
    };
}

/**
 * Create activity input for member added
 */
export function memberAddedActivity(
    userId: string,
    groupId: string,
    member: { name: string; email?: string; isPlaceholder?: boolean }
): ActivityInput {
    return {
        userId,
        groupId,
        action: member.isPlaceholder
            ? ActivityTypes.PLACEHOLDER_ADDED
            : ActivityTypes.MEMBER_ADDED,
        details: {
            member_name: member.name,
            member_email: member.email,
        },
    };
}
