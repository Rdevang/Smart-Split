import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Group = Database["public"]["Tables"]["groups"]["Row"];
type GroupMember = Database["public"]["Tables"]["group_members"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export interface PlaceholderMember {
    id: string;
    name: string;
    email: string | null;
}

export interface MemberWithProfile extends GroupMember {
    profile: Profile | null;
    placeholder: PlaceholderMember | null;
    is_placeholder: boolean;
}

export interface GroupWithMembers extends Group {
    members: MemberWithProfile[];
    member_count: number;
}

export interface GroupBalance {
    user_id: string;
    user_name: string;
    balance: number;
    is_placeholder?: boolean;
}

export interface PaginationParams {
    page?: number;
    limit?: number;
}

export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// Raw member type from Supabase query
interface RawGroupMember {
    id: string;
    user_id: string | null;
    placeholder_id: string | null;
    role: string;
    joined_at: string;
    profile: {
        id: string;
        email: string;
        full_name: string | null;
        avatar_url: string | null;
    } | null;
    placeholder: {
        id: string;
        name: string;
        email: string | null;
    } | null;
}

export const groupsServerService = {
    /**
     * Get paginated groups for a user
     * Optimized: Uses covering index, limits JOIN depth
     */
    async getGroups(
        userId: string,
        params: PaginationParams = {}
    ): Promise<PaginatedResult<GroupWithMembers>> {
        const supabase = await createClient();
        const page = Math.max(1, params.page || 1);
        const limit = Math.min(params.limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
        const offset = (page - 1) * limit;

        // Step 1: Get group IDs where user is a member (fast index lookup)
        const { data: memberGroups, error: memberError } = await supabase
            .from("group_members")
            .select("group_id")
            .eq("user_id", userId);

        if (memberError || !memberGroups) {
            console.error("Error fetching memberships:", memberError);
            return { data: [], total: 0, page, limit, hasMore: false };
        }

        const groupIds = memberGroups.map((m) => m.group_id);

        if (groupIds.length === 0) {
            return { data: [], total: 0, page, limit, hasMore: false };
        }

        // Step 2: Get groups with pagination
        const { data: groups, error: groupsError, count } = await supabase
            .from("groups")
            .select(`
                *,
                group_members (
                    id,
                    user_id,
                    placeholder_id,
                    role,
                    joined_at,
                    profile:profiles (
                        id,
                        email,
                        full_name,
                        avatar_url
                    ),
                    placeholder:placeholder_members (
                        id,
                        name,
                        email
                    )
                )
            `, { count: "exact" })
            .in("id", groupIds)
            .order("updated_at", { ascending: false })
            .range(offset, offset + limit - 1);

        if (groupsError || !groups) {
            console.error("Error fetching groups:", groupsError);
            return { data: [], total: 0, page, limit, hasMore: false };
        }

        const total = count || 0;
        const data = groups.map((group) => ({
            ...group,
            members: (group.group_members || []).map((m: RawGroupMember) => ({
                ...m,
                profile: m.profile || null,
                placeholder: m.placeholder || null,
                is_placeholder: m.placeholder_id !== null,
            })) as MemberWithProfile[],
            member_count: group.group_members?.length || 0,
        }));

        return {
            data,
            total,
            page,
            limit,
            hasMore: offset + limit < total,
        };
    },

    /**
     * Get single group with members
     * Optimized: Single query with selective fields
     */
    async getGroup(groupId: string): Promise<GroupWithMembers | null> {
        const supabase = await createClient();

        const { data: group, error } = await supabase
            .from("groups")
            .select(`
                *,
                group_members (
                    id,
                    user_id,
                    placeholder_id,
                    role,
                    joined_at,
                    profile:profiles (
                        id,
                        email,
                        full_name,
                        avatar_url
                    ),
                    placeholder:placeholder_members (
                        id,
                        name,
                        email
                    )
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
            members: (group.group_members || []).map((m: RawGroupMember) => ({
                ...m,
                profile: m.profile || null,
                placeholder: m.placeholder || null,
                is_placeholder: m.placeholder_id !== null,
            })) as MemberWithProfile[],
            member_count: group.group_members?.length || 0,
        };
    },

    /**
     * Get group balances using optimized database function
     * The function uses indexed queries internally
     */
    async getGroupBalances(groupId: string): Promise<GroupBalance[]> {
        const supabase = await createClient();

        const { data, error } = await supabase.rpc("get_group_balances", {
            group_uuid: groupId,
        });

        if (error) {
            console.error("Error fetching balances:", error);
            return [];
        }

        return data || [];
    },

    /**
     * Check if user is admin - uses indexed function
     */
    async isUserAdmin(groupId: string, userId: string): Promise<boolean> {
        const supabase = await createClient();

        // Use the optimized RPC function instead of direct query
        const { data, error } = await supabase.rpc("is_group_admin", {
            group_uuid: groupId,
            user_uuid: userId,
        });

        if (error) {
            console.error("Error checking admin status:", error);
            return false;
        }

        return data || false;
    },

    /**
     * Check if user is member - uses indexed function
     */
    async isUserMember(groupId: string, userId: string): Promise<boolean> {
        const supabase = await createClient();

        const { data, error } = await supabase.rpc("is_group_member", {
            group_uuid: groupId,
            user_uuid: userId,
        });

        if (error) {
            console.error("Error checking membership:", error);
            return false;
        }

        return data || false;
    },

    /**
     * Get group count for user (for stats without full data)
     */
    async getGroupCount(userId: string): Promise<number> {
        const supabase = await createClient();

        const { count, error } = await supabase
            .from("group_members")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId);

        if (error) {
            console.error("Error counting groups:", error);
            return 0;
        }

        return count || 0;
    },

    /**
     * Get group by invite code - for server-side validation
     */
    async getGroupByInviteCode(code: string): Promise<{ id: string; name: string; description: string | null; member_count: number } | null> {
        const supabase = await createClient();

        const { data, error } = await supabase
            .from("groups")
            .select(`
                id, 
                name, 
                description,
                group_members (id)
            `)
            .eq("invite_code", code.toUpperCase().trim())
            .single();

        if (error || !data) {
            return null;
        }

        return {
            id: data.id,
            name: data.name,
            description: data.description,
            member_count: data.group_members?.length || 0,
        };
    },

    /**
     * Check if user is already a member of a group
     */
    async isUserInGroup(groupId: string, userId: string): Promise<boolean> {
        const supabase = await createClient();

        const { data, error } = await supabase
            .from("group_members")
            .select("id")
            .eq("group_id", groupId)
            .eq("user_id", userId)
            .single();

        if (error) {
            return false;
        }

        return !!data;
    },
};
