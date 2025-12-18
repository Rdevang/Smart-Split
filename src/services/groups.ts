import { createClient } from "@/lib/supabase/client";
import { withLock, LockKeys } from "@/lib/distributed-lock";
import type { Database } from "@/types/database";
import { ValidationSchemas, sanitizeForDb, stripHtml } from "@/lib/validation";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { logger, SecurityEvents } from "@/lib/logger";

type Group = Database["public"]["Tables"]["groups"]["Row"];
type GroupMember = Database["public"]["Tables"]["group_members"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type MemberRole = Database["public"]["Enums"]["member_role"];

// ============================================
// AUTHORIZATION HELPERS (IDOR Prevention)
// ============================================

interface MembershipInfo {
    isMember: boolean;
    role: MemberRole | null;
    isAdmin: boolean;
}

/**
 * Verify user is a member of the specified group and get their role
 * Used for authorization checks before sensitive operations
 */
async function getGroupMembership(groupId: string, userId: string): Promise<MembershipInfo> {
    const supabase = createClient();
    
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
 * Verify user has access to a group
 * Logs security events for unauthorized access attempts
 */
async function verifyGroupAccess(
    groupId: string, 
    userId: string, 
    requiredRole: "member" | "admin" = "member",
    action: string
): Promise<{ success: boolean; membership?: MembershipInfo; error?: string }> {
    const membership = await getGroupMembership(groupId, userId);
    
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
            console.error("Error fetching memberships:", membershipError);
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
            console.error("Error fetching groups:", groupsError);
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
            console.error("Error fetching group:", error);
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
        await supabase.from("activities").insert({
            user_id: userId,
            group_id: group.id,
            entity_type: "group",
            entity_id: group.id,
            action: "created",
            metadata: { group_name: group.name },
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
        const accessCheck = await verifyGroupAccess(groupId, updatedBy, "admin", "update_group");
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
        await supabase.from("activities").insert({
            user_id: updatedBy,
            group_id: groupId,
            entity_type: "group",
            entity_id: groupId,
            action: "updated",
            metadata: { changes: Object.keys(input) },
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
        const accessCheck = await verifyGroupAccess(groupId, deletedBy, "admin", "delete_group");
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
        await supabase.from("activities").insert({
            user_id: deletedBy,
            group_id: groupId,
            entity_type: "group",
            entity_id: groupId,
            action: "deleted",
            metadata: { group_name: group?.name },
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
        const accessCheck = await verifyGroupAccess(groupId, restoredBy, "admin", "restore_group");
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
        await supabase.from("activities").insert({
            user_id: restoredBy,
            group_id: groupId,
            entity_type: "group",
            entity_id: groupId,
            action: "restored",
            metadata: {},
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
        const accessCheck = await verifyGroupAccess(groupId, addedBy, "member", "add_member");
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
        const accessCheck = await verifyGroupAccess(groupId, addedBy, "member", "add_placeholder_member");
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
        await supabase.from("activities").insert({
            user_id: addedBy,
            group_id: groupId,
            entity_type: "member",
            entity_id: placeholder.id,
            action: "added",
            metadata: { member_name: name, is_placeholder: true },
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
        const accessCheck = await verifyGroupAccess(groupId, removedBy, "admin", "remove_placeholder_member");
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
        await supabase.from("activities").insert({
            user_id: removedBy,
            group_id: groupId,
            entity_type: "member",
            entity_id: placeholderId,
            action: "removed",
            metadata: { member_name: placeholder?.name, is_placeholder: true },
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
        const accessCheck = await verifyGroupAccess(groupId, removedBy, "member", "remove_member");
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
        await supabase.from("activities").insert({
            user_id: removedBy,
            group_id: groupId,
            entity_type: "member",
            entity_id: userId,
            action: "removed",
        });

        return { success: true };
    },

    async getGroupBalances(groupId: string): Promise<GroupBalance[]> {
        const supabase = createClient();

        const { data, error } = await supabase.rpc("get_group_balances", {
            group_uuid: groupId,
        });

        if (error) {
            console.error("Error fetching balances:", error);
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
        
        // SECURITY: Verify user is a member of this group (IDOR prevention)
        const accessCheck = await verifyGroupAccess(groupId, recordedBy, "member", "record_settlement");
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
        await supabase.from("activities").insert({
            user_id: recordedBy,
            group_id: groupId,
            entity_type: "settlement",
            action: needsApproval ? "requested" : "created",
            metadata: {
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
            console.error("Error fetching settlements:", error);
            return [];
        }

        return data || [];
    },

    async getSettlementsWithNames(groupId: string): Promise<{
        id: string;
        from_user: string;
        from_user_name: string;
        to_user: string;
        to_user_name: string;
        amount: number;
        settled_at: string;
        note: string | null;
        status?: string;
    }[]> {
        const supabase = createClient();

        const { data, error } = await supabase
            .from("settlements")
            .select(`
                id,
                from_user,
                to_user,
                from_placeholder_id,
                to_placeholder_id,
                amount,
                settled_at,
                requested_at,
                note,
                status,
                from_profile:profiles!settlements_from_user_fkey(id, full_name, email),
                to_profile:profiles!settlements_to_user_fkey(id, full_name, email),
                from_placeholder:placeholder_members!settlements_from_placeholder_id_fkey(id, name),
                to_placeholder:placeholder_members!settlements_to_placeholder_id_fkey(id, name)
            `)
            .eq("group_id", groupId)
            .in("status", ["approved", "pending"]) // Show approved and pending
            .order("settled_at", { ascending: false, nullsFirst: false })
            .order("requested_at", { ascending: false });

        if (error) {
            console.error("Error fetching settlements with names:", error);
            return [];
        }

        type ProfileData = { full_name: string | null; email: string };
        type PlaceholderData = { id: string; name: string };

        // Collect IDs that need placeholder lookup (profile join returned null)
        const placeholderIdsToLookup: string[] = [];
        (data || []).forEach((s) => {
            const fromProfile = s.from_profile as unknown as ProfileData | null;
            const toProfile = s.to_profile as unknown as ProfileData | null;
            const fromPlaceholder = s.from_placeholder as unknown as PlaceholderData | null;
            const toPlaceholder = s.to_placeholder as unknown as PlaceholderData | null;

            // If from_user has no profile AND no placeholder, it might be an old record with placeholder ID in from_user
            if (s.from_user && !fromProfile?.full_name && !fromProfile?.email && !fromPlaceholder?.name) {
                placeholderIdsToLookup.push(s.from_user);
            }
            // Same for to_user
            if (s.to_user && !toProfile?.full_name && !toProfile?.email && !toPlaceholder?.name) {
                placeholderIdsToLookup.push(s.to_user);
            }
        });

        // Fetch placeholder names for old records that stored placeholder ID in from_user/to_user
        const placeholderNameMap = new Map<string, string>();
        if (placeholderIdsToLookup.length > 0) {
            const { data: placeholders } = await supabase
                .from("placeholder_members")
                .select("id, name")
                .in("id", placeholderIdsToLookup);

            (placeholders || []).forEach((p) => {
                placeholderNameMap.set(p.id, p.name);
            });
        }

        return (data || []).map((s) => {
            // Handle both real users and placeholders
            const fromProfile = s.from_profile as unknown as ProfileData | null;
            const toProfile = s.to_profile as unknown as ProfileData | null;
            const fromPlaceholder = s.from_placeholder as unknown as PlaceholderData | null;
            const toPlaceholder = s.to_placeholder as unknown as PlaceholderData | null;

            // Determine names - check placeholder first, then profile, then fallback lookup
            const fromName = fromPlaceholder?.name
                || fromProfile?.full_name
                || fromProfile?.email
                || placeholderNameMap.get(s.from_user) // Fallback for old records
                || "Unknown";
            const toName = toPlaceholder?.name
                || toProfile?.full_name
                || toProfile?.email
                || placeholderNameMap.get(s.to_user) // Fallback for old records
                || "Unknown";

            // Check if this involves a placeholder (should be auto-approved)
            const involvesPlaceholder = !!fromPlaceholder?.name
                || !!toPlaceholder?.name
                || placeholderNameMap.has(s.from_user)
                || placeholderNameMap.has(s.to_user)
                || !!s.from_placeholder_id
                || !!s.to_placeholder_id;

            // Auto-approve settlements involving placeholders (they can't respond)
            const effectiveStatus = (s.status === "pending" && involvesPlaceholder)
                ? "approved"
                : s.status;

            return {
                id: s.id,
                from_user: s.from_user || s.from_placeholder_id || "",
                from_user_name: fromName,
                to_user: s.to_user || s.to_placeholder_id || "",
                to_user_name: toName,
                amount: s.amount,
                settled_at: s.settled_at || s.requested_at || new Date().toISOString(),
                note: s.note,
                status: effectiveStatus,
            };
        });
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
            console.error("Error fetching pending settlements:", error);
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
            console.error("Error approving settlement:", error);
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
            console.error("Error rejecting settlement:", error);
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
            console.error("Error regenerating invite code:", error);
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
            console.error("Error joining group:", error);
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

