import { createClient } from "@/lib/supabase/client";
import { withLock, LockKeys } from "@/lib/distributed-lock";
import type { Database } from "@/types/database";
import { ValidationSchemas, sanitizeForDb, stripHtml } from "@/lib/validation";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { logger, SecurityEvents } from "@/lib/logger";
import { getSettlementsWithNamesCore, type SettlementWithNames } from "@/services/shared/settlements";
import { verifyGroupAccess, getGroupMembership } from "@/lib/auth-helpers";
import { logActivity, ActivityTypes } from "@/lib/activity-logger";
import { log } from "@/lib/console-logger";

type Group = Database["public"]["Tables"]["groups"]["Row"];
type GroupMember = Database["public"]["Tables"]["group_members"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type MemberRole = Database["public"]["Enums"]["member_role"];

export interface GroupWithMembers extends Group {
    members: (GroupMember & { profile: Profile })[];
    member_count: number;
    currency?: string | null; // From database, may not be in generated types
}

export interface CreateGroupInput {
    name: string;
    description?: string;
    category?: string;
    currency?: string;
    simplify_debts?: boolean;
}

export interface UpdateGroupInput {
    name?: string;
    description?: string;
    category?: string;
    currency?: string;
    simplify_debts?: boolean;
    image_url?: string;
}

export interface GroupBalance {
    user_id: string;
    user_name: string;
    balance: number;
    is_placeholder?: boolean;
}

export const groupsService = {
    async getGroups(userId: string): Promise<GroupWithMembers[]> {
        const supabase = createClient();

        // Get all groups where user is a member
        const { data: membershipData, error: membershipError } = await supabase
            .from("group_members")
            .select("group_id")
            .eq("user_id", userId);

        if (membershipError || !membershipData) {
            log.error("Groups", "Failed to fetch memberships", membershipError);
            return [];
        }

        const groupIds = membershipData.map((m) => m.group_id);

        if (groupIds.length === 0) {
            return [];
        }

        // Get groups with members
        const { data: groups, error: groupsError } = await supabase
            .from("groups")
            .select(`
                *,
                group_members (
                    *,
                    profile:profiles (*)
                )
            `)
            .in("id", groupIds)
            .order("updated_at", { ascending: false });

        if (groupsError || !groups) {
            log.error("Groups", "Failed to fetch groups", groupsError);
            return [];
        }

        return groups.map((group) => ({
            ...group,
            members: group.group_members as (GroupMember & { profile: Profile })[],
            member_count: group.group_members?.length || 0,
        }));
    },

    async getGroup(groupId: string): Promise<GroupWithMembers | null> {
        const supabase = createClient();

        const { data: group, error } = await supabase
            .from("groups")
            .select(`
                *,
                group_members (
                    *,
                    profile:profiles (*)
                )
            `)
            .eq("id", groupId)
            .single();

        if (error || !group) {
            log.error("Groups", "Failed to fetch group", error);
            return null;
        }

        return {
            ...group,
            members: group.group_members as (GroupMember & { profile: Profile })[],
            member_count: group.group_members?.length || 0,
        };
    },

    async createGroup(
        userId: string,
        input: CreateGroupInput
    ): Promise<{ group: Group | null; error?: string }> {
        const supabase = createClient();

        // Create the group
        const { data: group, error: createError } = await supabase
            .from("groups")
            .insert({
                name: input.name,
                description: input.description || null,
                category: input.category || null,
                currency: input.currency || "USD",
                simplify_debts: input.simplify_debts ?? true,
                created_by: userId,
            })
            .select()
            .single();

        if (createError || !group) {
            return { group: null, error: createError?.message || "Failed to create group" };
        }

        // Add creator as admin member
        const { error: memberError } = await supabase
            .from("group_members")
            .insert({
                group_id: group.id,
                user_id: userId,
                role: "admin",
            });

        if (memberError) {
            // Rollback group creation
            await supabase.from("groups").delete().eq("id", group.id);
            return { group: null, error: memberError.message };
        }

        // Log activity
        await logActivity(supabase, {
            userId,
            groupId: group.id,
            action: ActivityTypes.GROUP_CREATED,
            details: { group_name: group.name },
            metadata: { entity_type: "group", entity_id: group.id },
        });

        return { group };
    },

    /**
     * Update group settings
     * SECURITY: Requires admin role for the group (IDOR prevention)
     */
    async updateGroup(
        groupId: string,
        input: UpdateGroupInput,
        updatedBy: string
    ): Promise<{ success: boolean; error?: string }> {
        const supabase = createClient();

        // SECURITY: Verify user is an admin of this group
        const accessCheck = await verifyGroupAccess(supabase, groupId, updatedBy, "admin", "update_group");
        if (!accessCheck.success) {
            return { success: false, error: accessCheck.error };
        }

        const { error } = await supabase
            .from("groups")
            .update({
                ...input,
                updated_at: new Date().toISOString(),
            })
            .eq("id", groupId);

        if (error) {
            return { success: false, error: error.message };
        }

        // Log activity
        await logActivity(supabase, {
            userId: updatedBy,
            groupId,
            action: ActivityTypes.GROUP_UPDATED,
            metadata: { entity_type: "group", entity_id: groupId, changes: Object.keys(input) },
        });

        return { success: true };
    },

    /**
     * Soft delete a group (sets deleted_at timestamp)
     * Group can be restored within 30 days before permanent deletion
     * SECURITY: Requires admin role for the group (IDOR prevention)
     */
    async deleteGroup(
        groupId: string,
        deletedBy: string
    ): Promise<{ success: boolean; error?: string }> {
        const supabase = createClient();

        // SECURITY: Verify user is an admin of this group
        const accessCheck = await verifyGroupAccess(supabase, groupId, deletedBy, "admin", "delete_group");
        if (!accessCheck.success) {
            return { success: false, error: accessCheck.error };
        }

        // Get group name for activity log
        const { data: group } = await supabase
            .from("groups")
            .select("name")
            .eq("id", groupId)
            .single();

        // Use soft delete RPC function for atomic operation
        const { error } = await supabase.rpc("soft_delete_group", {
            group_uuid: groupId,
        });

        if (error) {
            // Fallback to manual soft delete if RPC fails
            const { error: updateError } = await supabase
                .from("groups")
                .update({ deleted_at: new Date().toISOString() })
                .eq("id", groupId);

            if (updateError) {
                return { success: false, error: updateError.message };
            }

            // Also soft delete related records
            await supabase
                .from("expenses")
                .update({ deleted_at: new Date().toISOString() })
                .eq("group_id", groupId);

            await supabase
                .from("settlements")
                .update({ deleted_at: new Date().toISOString() })
                .eq("group_id", groupId);
        }

        // Log activity
        await logActivity(supabase, {
            userId: deletedBy,
            groupId,
            action: ActivityTypes.GROUP_DELETED,
            details: { group_name: group?.name },
            metadata: { entity_type: "group", entity_id: groupId },
        });

        return { success: true };
    },

    /**
     * Permanently delete a group (hard delete)
     * Use with caution - this cannot be undone
     */
    async permanentlyDeleteGroup(groupId: string): Promise<{ success: boolean; error?: string }> {
        const supabase = createClient();

        // Delete in order: expense_splits -> expenses -> settlements -> activities -> group_members -> group
        const { data: expenses } = await supabase
            .from("expenses")
            .select("id")
            .eq("group_id", groupId);

        if (expenses && expenses.length > 0) {
            const expenseIds = expenses.map((e) => e.id);

            // Delete expense splits
            await supabase
                .from("expense_splits")
                .delete()
                .in("expense_id", expenseIds);

            // Delete expenses
            await supabase.from("expenses").delete().eq("group_id", groupId);
        }

        // Delete settlements
        await supabase.from("settlements").delete().eq("group_id", groupId);

        // Delete activities
        await supabase.from("activities").delete().eq("group_id", groupId);

        // Delete group members
        await supabase.from("group_members").delete().eq("group_id", groupId);

        // Delete the group
        const { error } = await supabase.from("groups").delete().eq("id", groupId);

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true };
    },

    /**
     * Restore a soft-deleted group
     * SECURITY: Requires admin role (IDOR prevention)
     */
    async restoreGroup(
        groupId: string,
        restoredBy: string
    ): Promise<{ success: boolean; error?: string }> {
        const supabase = createClient();

        // SECURITY: Verify user was an admin of this group
        // Note: We check membership differently for deleted groups
        const accessCheck = await verifyGroupAccess(supabase, groupId, restoredBy, "admin", "restore_group");
        if (!accessCheck.success) {
            return { success: false, error: accessCheck.error };
        }

        const { error } = await supabase.rpc("restore_group", {
            group_uuid: groupId,
        });

        if (error) {
            return { success: false, error: error.message };
        }

        // Log activity
        await logActivity(supabase, {
            userId: restoredBy,
            groupId,
            action: ActivityTypes.GROUP_RESTORED,
            metadata: { entity_type: "group", entity_id: groupId },
        });

        return { success: true };
    },

    /**
     * Add a member to a group by email
     * SECURITY: Requires member role at minimum (IDOR prevention)
     */
    async addMember(
        groupId: string,
        email: string,
        addedBy: string
    ): Promise<{ success: boolean; error?: string; inviteSent?: boolean }> {
        const supabase = createClient();

        // SECURITY: Verify user is a member of this group
        const accessCheck = await verifyGroupAccess(supabase, groupId, addedBy, "member", "add_member");
        if (!accessCheck.success) {
            return { success: false, error: accessCheck.error };
        }

        // Find user by email
        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("id, full_name")
            .eq("email", email)
            .single();

        if (profileError || !profile) {
            return { success: false, error: "User not found with this email" };
        }

        // Check if already a member
        const { data: existingMember } = await supabase
            .from("group_members")
            .select("id")
            .eq("group_id", groupId)
            .eq("user_id", profile.id)
            .single();

        if (existingMember) {
            return { success: false, error: "User is already a member of this group" };
        }

        // Get group name and inviter name for the invitation
        const [{ data: group }, { data: inviter }] = await Promise.all([
            supabase.from("groups").select("name").eq("id", groupId).single(),
            supabase.from("profiles").select("full_name, email").eq("id", addedBy).single(),
        ]);

        // Send invitation instead of directly adding
        const { notificationsService } = await import("@/services/notifications");
        const inviteResult = await notificationsService.sendGroupInvitation(
            groupId,
            profile.id,
            addedBy,
            group?.name || "Unknown Group",
            inviter?.full_name || inviter?.email || "Someone"
        );

        if (!inviteResult.success) {
            return { success: false, error: inviteResult.error };
        }

        return { success: true, inviteSent: true };
    },

    /**
     * Add a placeholder member to a group
     * SECURITY: Requires member role at minimum (IDOR prevention)
     */
    async addPlaceholderMember(
        groupId: string,
        name: string,
        email: string | null,
        addedBy: string
    ): Promise<{ success: boolean; error?: string; placeholderId?: string }> {
        const supabase = createClient();

        // SECURITY: Verify user is a member of this group
        const accessCheck = await verifyGroupAccess(supabase, groupId, addedBy, "member", "add_placeholder_member");
        if (!accessCheck.success) {
            return { success: false, error: accessCheck.error };
        }

        // If email provided, check if user already exists
        if (email) {
            const { data: existingProfile } = await supabase
                .from("profiles")
                .select("id")
                .eq("email", email)
                .single();

            if (existingProfile) {
                return {
                    success: false,
                    error: "A user with this email already exists. Use 'Add existing user' instead."
                };
            }
        }

        // Check if placeholder with same name already exists in group
        const { data: existingPlaceholder } = await supabase
            .from("placeholder_members")
            .select("id")
            .eq("group_id", groupId)
            .ilike("name", name)
            .single();

        if (existingPlaceholder) {
            return { success: false, error: "A member with this name already exists in the group" };
        }

        // Create placeholder member
        const { data: placeholder, error: createError } = await supabase
            .from("placeholder_members")
            .insert({
                name: name.trim(),
                email: email?.trim() || null,
                group_id: groupId,
                created_by: addedBy,
            })
            .select("id")
            .single();

        if (createError) {
            return { success: false, error: createError.message };
        }

        // Add to group_members
        const { error: memberError } = await supabase
            .from("group_members")
            .insert({
                group_id: groupId,
                placeholder_id: placeholder.id,
                role: "member",
            });

        if (memberError) {
            // Rollback: delete placeholder if member insert fails
            await supabase.from("placeholder_members").delete().eq("id", placeholder.id);
            return { success: false, error: memberError.message };
        }

        // Log activity
        await logActivity(supabase, {
            userId: addedBy,
            groupId,
            action: ActivityTypes.PLACEHOLDER_ADDED,
            details: { member_name: name },
            metadata: { entity_type: "member", entity_id: placeholder.id, is_placeholder: true },
        });

        return { success: true, placeholderId: placeholder.id };
    },

    /**
     * Remove a placeholder member from a group
     * SECURITY: Requires admin role OR user removing themselves (IDOR prevention)
     */
    async removePlaceholderMember(
        groupId: string,
        placeholderId: string,
        removedBy: string
    ): Promise<{ success: boolean; error?: string }> {
        const supabase = createClient();

        // SECURITY: Verify user is an admin of this group
        const accessCheck = await verifyGroupAccess(supabase, groupId, removedBy, "admin", "remove_placeholder_member");
        if (!accessCheck.success) {
            return { success: false, error: accessCheck.error };
        }

        // Get placeholder name for activity log
        const { data: placeholder } = await supabase
            .from("placeholder_members")
            .select("name")
            .eq("id", placeholderId)
            .single();

        // Delete from group_members first (cascade will handle this, but explicit is clearer)
        const { error: memberError } = await supabase
            .from("group_members")
            .delete()
            .eq("group_id", groupId)
            .eq("placeholder_id", placeholderId);

        if (memberError) {
            return { success: false, error: memberError.message };
        }

        // Delete placeholder
        const { error } = await supabase
            .from("placeholder_members")
            .delete()
            .eq("id", placeholderId);

        if (error) {
            return { success: false, error: error.message };
        }

        // Log activity
        await logActivity(supabase, {
            userId: removedBy,
            groupId,
            action: ActivityTypes.PLACEHOLDER_REMOVED,
            details: { member_name: placeholder?.name },
            metadata: { entity_type: "member", entity_id: placeholderId, is_placeholder: true },
        });

        return { success: true };
    },

    /**
     * Remove a member from a group
     * SECURITY: Requires admin role OR user removing themselves (IDOR prevention)
     */
    async removeMember(
        groupId: string,
        userId: string,
        removedBy: string
    ): Promise<{ success: boolean; error?: string }> {
        const supabase = createClient();

        // SECURITY: Verify access - admin can remove anyone, user can remove themselves
        const accessCheck = await verifyGroupAccess(supabase, groupId, removedBy, "member", "remove_member");
        if (!accessCheck.success) {
            return { success: false, error: accessCheck.error };
        }

        // Only admins can remove other members
        if (userId !== removedBy && !accessCheck.membership?.isAdmin) {
            logger.security(
                SecurityEvents.ACCESS_DENIED,
                "medium",
                "blocked",
                { userId: removedBy, groupId, action: "remove_other_member", targetUser: userId, reason: "not_admin" }
            );
            return { success: false, error: "Only admins can remove other members" };
        }

        // Check if user is the only admin
        const { data: admins } = await supabase
            .from("group_members")
            .select("user_id")
            .eq("group_id", groupId)
            .eq("role", "admin");

        if (admins && admins.length === 1 && admins[0].user_id === userId) {
            return { success: false, error: "Cannot remove the only admin. Transfer ownership first." };
        }

        // Get member name for activity log
        const { data: member } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", userId)
            .single();

        const { error } = await supabase
            .from("group_members")
            .delete()
            .eq("group_id", groupId)
            .eq("user_id", userId);

        if (error) {
            return { success: false, error: error.message };
        }

        // Log activity
        await logActivity(supabase, {
            userId: removedBy,
            groupId,
            action: ActivityTypes.MEMBER_REMOVED,
            metadata: { entity_type: "member", entity_id: userId },
        });

        return { success: true };
    },

    async getGroupBalances(groupId: string): Promise<GroupBalance[]> {
        const supabase = createClient();

        const { data, error } = await supabase.rpc("get_group_balances", {
            group_uuid: groupId,
        });

        if (error) {
            log.error("Groups", "Failed to fetch balances", error);
            return [];
        }

        return data || [];
    },

    async isUserAdmin(groupId: string, userId: string): Promise<boolean> {
        const supabase = createClient();

        const { data } = await supabase
            .from("group_members")
            .select("role")
            .eq("group_id", groupId)
            .eq("user_id", userId)
            .single();

        return data?.role === "admin";
    },

    async recordSettlement(
        groupId: string,
        fromUserId: string,
        toUserId: string,
        amount: number,
        recordedBy: string,
        fromIsPlaceholder: boolean = false,
        toIsPlaceholder: boolean = false
    ): Promise<{ success: boolean; error?: string; pending?: boolean; message?: string }> {
        // Use distributed lock to prevent double settlements
        // This ensures only one settlement can be processed at a time for this pair
        try {
            return await withLock(
                LockKeys.settlement(groupId, fromUserId, toUserId),
                async () => {
                    return this._recordSettlementInternal(
                        groupId, fromUserId, toUserId, amount, recordedBy,
                        fromIsPlaceholder, toIsPlaceholder
                    );
                },
                { ttl: 15 }  // 15 second lock timeout
            );
        } catch (error) {
            if (error instanceof Error && error.message.includes("being processed")) {
                return {
                    success: false,
                    error: "This settlement is already being processed. Please wait and try again."
                };
            }
            throw error;
        }
    },

    // Internal implementation (called within lock)
    async _recordSettlementInternal(
        groupId: string,
        fromUserId: string,
        toUserId: string,
        amount: number,
        recordedBy: string,
        fromIsPlaceholder: boolean = false,
        toIsPlaceholder: boolean = false
    ): Promise<{ success: boolean; error?: string; pending?: boolean; message?: string }> {
        const supabase = createClient();

        // VALIDATION: Amount must be positive and reasonable
        if (!amount || amount <= 0) {
            return { success: false, error: "Settlement amount must be positive" };
        }

        if (amount > 10000000) { // $10M cap for sanity
            return { success: false, error: "Settlement amount exceeds maximum limit" };
        }

        // Round to 2 decimal places to avoid floating point issues
        amount = Math.round(amount * 100) / 100;

        // SECURITY: Verify user is a member of this group (IDOR prevention)
        const accessCheck = await verifyGroupAccess(supabase, groupId, recordedBy, "member", "record_settlement");
        if (!accessCheck.success) {
            return { success: false, error: accessCheck.error };
        }

        // Determine if approval is needed:
        // Auto-approve if:
        // 1. The receiver (to_user) is a placeholder (can't approve)
        // 2. The receiver IS the person recording it (they clicked "Mark Paid" to confirm they received money)
        // 3. The payer (from_user) is a placeholder (current user is settling on their behalf)
        const currentUserIsReceiver = toUserId === recordedBy;
        const needsApproval = !toIsPlaceholder && !currentUserIsReceiver && !fromIsPlaceholder;

        const settlementData: {
            group_id: string;
            amount: number;
            from_user?: string;
            from_placeholder_id?: string;
            to_user?: string;
            to_placeholder_id?: string;
            status: string;
            requested_by: string;
            settled_at?: string;
        } = {
            group_id: groupId,
            amount,
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
            return { success: false, error: settlementError.message };
        }

        // For auto-approved settlements (to placeholders), mark splits as settled immediately
        // For pending settlements (to real users), splits are marked when they approve
        if (!needsApproval) {
            // Mark relevant expense splits as settled
            if (toIsPlaceholder) {
                // If payee is placeholder, find expenses they paid
                const { data: expenses } = await supabase
                    .from("expenses")
                    .select("id")
                    .eq("group_id", groupId)
                    .eq("paid_by_placeholder_id", toUserId);

                if (expenses && expenses.length > 0) {
                    const expenseIds = expenses.map((e) => e.id);

                    if (fromIsPlaceholder) {
                        await supabase
                            .from("expense_splits")
                            .update({ is_settled: true, settled_at: new Date().toISOString() })
                            .in("expense_id", expenseIds)
                            .eq("placeholder_id", fromUserId)
                            .eq("is_settled", false);
                    } else {
                        await supabase
                            .from("expense_splits")
                            .update({ is_settled: true, settled_at: new Date().toISOString() })
                            .in("expense_id", expenseIds)
                            .eq("user_id", fromUserId)
                            .eq("is_settled", false);
                    }
                }
            }
        }

        // Log activity
        await logActivity(supabase, {
            userId: recordedBy,
            groupId,
            action: needsApproval ? ActivityTypes.SETTLEMENT_REQUESTED : ActivityTypes.SETTLEMENT_RECORDED,
            metadata: {
                entity_type: "settlement",
                from_user: fromUserId,
                to_user: toUserId,
                amount,
                from_is_placeholder: fromIsPlaceholder,
                to_is_placeholder: toIsPlaceholder,
                status: needsApproval ? "pending" : "approved",
            },
        });

        return {
            success: true,
            pending: needsApproval,
            message: needsApproval
                ? "Settlement request sent for approval"
                : "Settlement recorded"
        };
    },

    async getSettlements(groupId: string): Promise<{
        id: string;
        from_user: string;
        to_user: string;
        amount: number;
        settled_at: string;
    }[]> {
        const supabase = createClient();

        const { data, error } = await supabase
            .from("settlements")
            .select("id, from_user, to_user, amount, settled_at")
            .eq("group_id", groupId)
            .order("settled_at", { ascending: false });

        if (error) {
            log.error("Groups", "Failed to fetch settlements", error);
            return [];
        }

        return data || [];
    },

    async getSettlementsWithNames(groupId: string): Promise<SettlementWithNames[]> {
        const supabase = createClient();
        return getSettlementsWithNamesCore(supabase, groupId);
    },

    /**
     * Get pending settlement requests for a user (where they need to approve)
     */
    async getPendingSettlements(userId: string): Promise<{
        id: string;
        group_id: string;
        group_name: string;
        from_user_id: string;
        from_user_name: string;
        amount: number;
        requested_at: string;
    }[]> {
        const supabase = createClient();

        const { data, error } = await supabase
            .from("settlements")
            .select(`
                id,
                group_id,
                amount,
                requested_at,
                from_user,
                groups!settlements_group_id_fkey(name),
                from_profile:profiles!settlements_from_user_fkey(id, full_name, email)
            `)
            .eq("to_user", userId)
            .eq("status", "pending")
            .order("requested_at", { ascending: false });

        if (error) {
            log.error("Groups", "Failed to fetch pending settlements", error);
            return [];
        }

        type ProfileData = { full_name: string | null; email: string };
        type GroupData = { name: string };

        return (data || []).map((s) => {
            const fromProfile = s.from_profile as unknown as ProfileData | null;
            const group = s.groups as unknown as GroupData | null;

            return {
                id: s.id,
                group_id: s.group_id || "",
                group_name: group?.name || "Unknown Group",
                from_user_id: s.from_user || "",
                from_user_name: fromProfile?.full_name || fromProfile?.email || "Unknown",
                amount: s.amount,
                requested_at: s.requested_at || new Date().toISOString(),
            };
        });
    },

    /**
     * Approve a pending settlement
     */
    async approveSettlement(settlementId: string): Promise<{ success: boolean; error?: string }> {
        const supabase = createClient();

        const { data, error } = await supabase.rpc("approve_settlement", {
            settlement_uuid: settlementId,
        });

        if (error) {
            log.error("Groups", "Failed to approve settlement", error);
            return { success: false, error: error.message };
        }

        return { success: data === true };
    },

    /**
     * Reject a pending settlement
     */
    async rejectSettlement(settlementId: string): Promise<{ success: boolean; error?: string }> {
        const supabase = createClient();

        const { data, error } = await supabase.rpc("reject_settlement", {
            settlement_uuid: settlementId,
        });

        if (error) {
            log.error("Groups", "Failed to reject settlement", error);
            return { success: false, error: error.message };
        }

        return { success: data === true };
    },

    async regenerateInviteCode(groupId: string): Promise<{ success: boolean; error?: string; inviteCode?: string }> {
        const supabase = createClient();

        const { data, error } = await supabase.rpc("regenerate_group_invite_code", {
            group_uuid: groupId,
        });

        if (error) {
            log.error("Groups", "Failed to regenerate invite code", error);
            return { success: false, error: error.message };
        }

        return { success: true, inviteCode: data };
    },

    async joinGroupByInviteCode(
        code: string,
        userId: string
    ): Promise<{ success: boolean; error?: string; groupId?: string; groupName?: string }> {
        const supabase = createClient();

        const { data, error } = await supabase.rpc("join_group_by_invite_code", {
            code: code.toUpperCase().trim(),
            joining_user_id: userId,
        });

        if (error) {
            log.error("Groups", "Failed to join group", error);
            return { success: false, error: error.message };
        }

        const result = data as { success: boolean; error?: string; group_id?: string; group_name?: string };

        if (!result.success) {
            return { success: false, error: result.error };
        }

        return {
            success: true,
            groupId: result.group_id,
            groupName: result.group_name
        };
    },

    async getGroupByInviteCode(code: string): Promise<{ id: string; name: string } | null> {
        const supabase = createClient();

        const { data, error } = await supabase
            .from("groups")
            .select("id, name")
            .eq("invite_code", code.toUpperCase().trim())
            .single();

        if (error || !data) {
            return null;
        }

        return data;
    },
};

