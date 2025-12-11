import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type Group = Database["public"]["Tables"]["groups"]["Row"];
type GroupMember = Database["public"]["Tables"]["group_members"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export interface GroupWithMembers extends Group {
    members: (GroupMember & { profile: Profile })[];
    member_count: number;
}

export interface CreateGroupInput {
    name: string;
    description?: string;
    category?: string;
    simplify_debts?: boolean;
}

export interface UpdateGroupInput {
    name?: string;
    description?: string;
    category?: string;
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

    async updateGroup(
        groupId: string,
        input: UpdateGroupInput
    ): Promise<{ success: boolean; error?: string }> {
        const supabase = createClient();

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

        return { success: true };
    },

    async deleteGroup(groupId: string): Promise<{ success: boolean; error?: string }> {
        const supabase = createClient();

        // Delete in order: expense_splits -> expenses -> group_members -> activities -> group
        // First get all expenses in this group
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

    async addMember(
        groupId: string,
        email: string,
        addedBy: string
    ): Promise<{ success: boolean; error?: string }> {
        const supabase = createClient();

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

        // Add member
        const { error: addError } = await supabase
            .from("group_members")
            .insert({
                group_id: groupId,
                user_id: profile.id,
                role: "member",
            });

        if (addError) {
            return { success: false, error: addError.message };
        }

        // Log activity
        await supabase.from("activities").insert({
            user_id: addedBy,
            group_id: groupId,
            entity_type: "member",
            entity_id: profile.id,
            action: "added",
            metadata: { member_name: profile.full_name },
        });

        return { success: true };
    },

    async addPlaceholderMember(
        groupId: string,
        name: string,
        email: string | null,
        addedBy: string
    ): Promise<{ success: boolean; error?: string; placeholderId?: string }> {
        const supabase = createClient();

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

    async removePlaceholderMember(
        groupId: string,
        placeholderId: string,
        removedBy: string
    ): Promise<{ success: boolean; error?: string }> {
        const supabase = createClient();

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

        return { success: true };
    },

    async removeMember(
        groupId: string,
        userId: string,
        removedBy: string
    ): Promise<{ success: boolean; error?: string }> {
        const supabase = createClient();

        // Check if user is the only admin
        const { data: admins } = await supabase
            .from("group_members")
            .select("user_id")
            .eq("group_id", groupId)
            .eq("role", "admin");

        if (admins && admins.length === 1 && admins[0].user_id === userId) {
            return { success: false, error: "Cannot remove the only admin. Transfer ownership first." };
        }

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
        recordedBy: string
    ): Promise<{ success: boolean; error?: string }> {
        const supabase = createClient();

        // Create settlement record
        const { error: settlementError } = await supabase
            .from("settlements")
            .insert({
                group_id: groupId,
                from_user: fromUserId,
                to_user: toUserId,
                amount,
            });

        if (settlementError) {
            return { success: false, error: settlementError.message };
        }

        // Mark relevant expense splits as settled
        // Find unsettled splits where from_user owes to_user
        const { data: expenses } = await supabase
            .from("expenses")
            .select("id")
            .eq("group_id", groupId)
            .eq("paid_by", toUserId);

        if (expenses && expenses.length > 0) {
            const expenseIds = expenses.map((e) => e.id);

            await supabase
                .from("expense_splits")
                .update({
                    is_settled: true,
                    settled_at: new Date().toISOString(),
                })
                .in("expense_id", expenseIds)
                .eq("user_id", fromUserId)
                .eq("is_settled", false);
        }

        // Log activity
        await supabase.from("activities").insert({
            user_id: recordedBy,
            group_id: groupId,
            entity_type: "settlement",
            action: "created",
            metadata: {
                from_user: fromUserId,
                to_user: toUserId,
                amount,
            },
        });

        return { success: true };
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
            .select("*")
            .eq("group_id", groupId)
            .order("settled_at", { ascending: false });

        if (error) {
            console.error("Error fetching settlements:", error);
            return [];
        }

        return data || [];
    },
};

