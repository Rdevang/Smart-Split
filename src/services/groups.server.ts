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
    currency?: string | null; // From database, may not be in generated types
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

        // Collect all placeholder IDs that need fallback lookup
        const allPlaceholderIds: string[] = [];
        groups.forEach((group) => {
            (group.group_members || []).forEach((m: RawGroupMember) => {
                if (m.placeholder_id && !m.placeholder) {
                    allPlaceholderIds.push(m.placeholder_id);
                }
            });
        });

        // Fallback: Fetch placeholder names separately if join failed
        const placeholderMap = new Map<string, { id: string; name: string; email: string | null }>();
        if (allPlaceholderIds.length > 0) {
            const { data: placeholders } = await supabase
                .from("placeholder_members")
                .select("id, name, email")
                .in("id", allPlaceholderIds);

            (placeholders || []).forEach((p) => {
                placeholderMap.set(p.id, p);
            });
        }

        const total = count || 0;
        const data = groups.map((group) => ({
            ...group,
            members: (group.group_members || []).map((m: RawGroupMember) => ({
                ...m,
                profile: m.profile || null,
                placeholder: m.placeholder || (m.placeholder_id ? placeholderMap.get(m.placeholder_id) : null) || null,
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

        // Collect placeholder IDs that need fallback lookup (join returned null)
        const placeholderIdsToLookup = (group.group_members || [])
            .filter((m: RawGroupMember) => m.placeholder_id && !m.placeholder)
            .map((m: RawGroupMember) => m.placeholder_id as string);

        // Fallback: Fetch placeholder names separately if join failed
        const placeholderMap = new Map<string, { id: string; name: string; email: string | null }>();
        if (placeholderIdsToLookup.length > 0) {
            const { data: placeholders } = await supabase
                .from("placeholder_members")
                .select("id, name, email")
                .in("id", placeholderIdsToLookup);

            (placeholders || []).forEach((p) => {
                placeholderMap.set(p.id, p);
            });
        }

        return {
            ...group,
            members: (group.group_members || []).map((m: RawGroupMember) => ({
                ...m,
                profile: m.profile || null,
                placeholder: m.placeholder || (m.placeholder_id ? placeholderMap.get(m.placeholder_id) : null) || null,
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

    /**
     * Get settlements with user names for a group
     */
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
        const supabase = await createClient();

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
            .in("status", ["approved", "pending"])
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
};
