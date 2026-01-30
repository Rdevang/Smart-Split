/**
 * Centralized Authorization Helpers
 * 
 * This module provides reusable authorization functions for verifying
 * user access to resources. Used by both client and server services
 * to prevent IDOR (Insecure Direct Object Reference) attacks.
 * 
 * SECURITY: These functions should be called before any sensitive operation.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { ValidationSchemas } from "@/lib/validation";
import { logger, SecurityEvents } from "@/lib/logger";

// ============================================
// TYPES
// ============================================

export type MemberRole = "admin" | "member";

export interface MembershipInfo {
    isMember: boolean;
    role: MemberRole | null;
    isAdmin: boolean;
}

export interface AccessResult {
    success: boolean;
    membership?: MembershipInfo;
    error?: string;
}

export interface ExpenseAccessResult {
    groupId: string;
    expense: {
        id: string;
        group_id: string;
        description: string;
        amount: number;
        [key: string]: unknown;
    };
}

export interface SplitAccessResult {
    expenseId: string;
    groupId: string;
}

// ============================================
// GROUP MEMBERSHIP CHECKS
// ============================================

/**
 * Check if a user is a member of a group
 * 
 * @param supabase - Supabase client
 * @param groupId - Group ID to check
 * @param userId - User ID to check
 * @returns true if user is a member
 */
export async function isGroupMember(
    supabase: SupabaseClient,
    groupId: string,
    userId: string
): Promise<boolean> {
    // Validate inputs
    if (!ValidationSchemas.uuid.safeParse(groupId).success ||
        !ValidationSchemas.uuid.safeParse(userId).success) {
        return false;
    }

    const { data } = await supabase
        .from("group_members")
        .select("id")
        .eq("group_id", groupId)
        .eq("user_id", userId)
        .single();

    return !!data;
}

/**
 * Get detailed membership information for a user in a group
 * 
 * @param supabase - Supabase client
 * @param groupId - Group ID
 * @param userId - User ID
 * @returns Membership details including role
 */
export async function getGroupMembership(
    supabase: SupabaseClient,
    groupId: string,
    userId: string
): Promise<MembershipInfo> {
    // Validate inputs
    if (!ValidationSchemas.uuid.safeParse(groupId).success ||
        !ValidationSchemas.uuid.safeParse(userId).success) {
        return { isMember: false, role: null, isAdmin: false };
    }

    const { data } = await supabase
        .from("group_members")
        .select("role")
        .eq("group_id", groupId)
        .eq("user_id", userId)
        .single();

    if (!data) {
        return { isMember: false, role: null, isAdmin: false };
    }

    return {
        isMember: true,
        role: data.role as MemberRole,
        isAdmin: data.role === "admin"
    };
}

/**
 * Verify user has access to a group with required role
 * Logs security events for unauthorized access attempts
 * 
 * @param supabase - Supabase client
 * @param groupId - Group ID
 * @param userId - User ID
 * @param requiredRole - Required role ("member" or "admin")
 * @param action - Action being performed (for logging)
 * @returns Access result with membership info
 */
export async function verifyGroupAccess(
    supabase: SupabaseClient,
    groupId: string,
    userId: string,
    requiredRole: "member" | "admin" = "member",
    action: string
): Promise<AccessResult> {
    const membership = await getGroupMembership(supabase, groupId, userId);

    if (!membership.isMember) {
        logger.security(
            SecurityEvents.ACCESS_DENIED,
            "medium",
            "blocked",
            { userId, groupId, action, reason: "not_group_member" }
        );
        return { success: false, error: "Group not found or access denied" };
    }

    if (requiredRole === "admin" && !membership.isAdmin) {
        logger.security(
            SecurityEvents.ACCESS_DENIED,
            "medium",
            "blocked",
            { userId, groupId, action, reason: "not_admin", currentRole: membership.role }
        );
        return { success: false, error: "Admin access required" };
    }

    return { success: true, membership };
}

// ============================================
// EXPENSE ACCESS CHECKS
// ============================================

/**
 * Verify user has access to an expense
 * Returns expense details and group ID if access is granted
 * 
 * @param supabase - Supabase client
 * @param expenseId - Expense ID
 * @param userId - User ID
 * @returns Expense and group info, or null if no access
 */
export async function verifyExpenseAccess(
    supabase: SupabaseClient,
    expenseId: string,
    userId: string
): Promise<ExpenseAccessResult | null> {
    // Validate inputs
    if (!ValidationSchemas.uuid.safeParse(expenseId).success ||
        !ValidationSchemas.uuid.safeParse(userId).success) {
        logger.warn("Invalid UUID in expense access check", { expenseId, userId });
        return null;
    }

    // Get expense with group_id (only select needed columns to avoid schema issues)
    const { data: expense, error } = await supabase
        .from("expenses")
        .select("id, group_id, description, amount, paid_by, category, expense_date, notes")
        .eq("id", expenseId)
        .single();

    if (error || !expense) {
        return null;
    }

    // Verify user is a member of the group
    const isMember = await isGroupMember(supabase, expense.group_id, userId);

    if (!isMember) {
        logger.security(
            SecurityEvents.ACCESS_DENIED,
            "medium",
            "blocked",
            {
                userId,
                expenseId,
                groupId: expense.group_id,
                action: "expense_access",
                reason: "not_group_member"
            }
        );
        return null;
    }

    return { groupId: expense.group_id, expense };
}

/**
 * Verify user has access to an expense split
 * Returns expense ID and group ID if access is granted
 * 
 * @param supabase - Supabase client
 * @param splitId - Split ID
 * @param userId - User ID
 * @returns Split info, or null if no access
 */
export async function verifySplitAccess(
    supabase: SupabaseClient,
    splitId: string,
    userId: string
): Promise<SplitAccessResult | null> {
    // Validate inputs
    if (!ValidationSchemas.uuid.safeParse(splitId).success ||
        !ValidationSchemas.uuid.safeParse(userId).success) {
        return null;
    }

    // Get split with expense info
    const { data: split, error } = await supabase
        .from("expense_splits")
        .select("expense_id, expense:expenses(group_id)")
        .eq("id", splitId)
        .single();

    if (error || !split || !split.expense) {
        return null;
    }

    // Type cast through unknown for Supabase join result
    const expenseData = split.expense as unknown as { group_id: string };
    const groupId = expenseData.group_id;

    // Verify user is a member of the group
    const isMember = await isGroupMember(supabase, groupId, userId);

    if (!isMember) {
        logger.security(
            SecurityEvents.ACCESS_DENIED,
            "medium",
            "blocked",
            {
                userId,
                splitId,
                groupId,
                action: "split_access",
                reason: "not_group_member"
            }
        );
        return null;
    }

    return { expenseId: split.expense_id, groupId };
}
