import { createClient } from "@/lib/supabase/server";

export interface PastMember {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
    is_placeholder: boolean;
    groups_shared: number;
}

export const friendsServerService = {
    /**
     * Get all people you've been in groups with (past co-members)
     * Server-side optimized version with parallel queries
     */
    async getPastGroupMembers(userId: string): Promise<PastMember[]> {
        const supabase = await createClient();

        // Step 1: Get all groups the user is part of
        const { data: userGroups } = await supabase
            .from("group_members")
            .select("group_id")
            .eq("user_id", userId);

        if (!userGroups || userGroups.length === 0) {
            return [];
        }

        const groupIds = userGroups.map((g) => g.group_id);

        // Step 2: Parallel fetch both real and placeholder members
        const [realMembersResult, placeholderMembersResult] = await Promise.all([
            supabase
                .from("group_members")
                .select(`
                    user_id,
                    group_id,
                    profile:profiles!group_members_user_id_fkey (
                        id,
                        email,
                        full_name,
                        avatar_url
                    )
                `)
                .in("group_id", groupIds)
                .not("user_id", "is", null)
                .neq("user_id", userId),
            supabase
                .from("group_members")
                .select(`
                    placeholder_id,
                    group_id,
                    placeholder:placeholder_members (
                        id,
                        name,
                        email
                    )
                `)
                .in("group_id", groupIds)
                .not("placeholder_id", "is", null),
        ]);

        const realMembers = realMembersResult.data || [];
        const placeholderMembers = placeholderMembersResult.data || [];

        // Aggregate real members by user
        const memberMap = new Map<string, PastMember>();

        /* eslint-disable @typescript-eslint/no-explicit-any */
        realMembers.forEach((m: any) => {
            const profile = Array.isArray(m.profile) ? m.profile[0] : m.profile;
            if (!profile) return;

            const existing = memberMap.get(profile.id);
            if (existing) {
                existing.groups_shared += 1;
            } else {
                memberMap.set(profile.id, {
                    id: profile.id,
                    name: profile.full_name || profile.email,
                    email: profile.email,
                    avatar_url: profile.avatar_url,
                    is_placeholder: false,
                    groups_shared: 1,
                });
            }
        });

        // Aggregate placeholder members - deduplicate by name
        const placeholderByName = new Map<string, PastMember>();

        placeholderMembers.forEach((m: any) => {
            const placeholder = Array.isArray(m.placeholder) ? m.placeholder[0] : m.placeholder;
            if (!placeholder) return;

            const nameKey = placeholder.name.toLowerCase().trim();
            const existing = placeholderByName.get(nameKey);

            if (existing) {
                existing.groups_shared += 1;
            } else {
                placeholderByName.set(nameKey, {
                    id: placeholder.id,
                    name: placeholder.name,
                    email: placeholder.email || "",
                    avatar_url: null,
                    is_placeholder: true,
                    groups_shared: 1,
                });
            }
        });
        /* eslint-enable @typescript-eslint/no-explicit-any */

        // Merge placeholders into memberMap
        placeholderByName.forEach((member, nameKey) => {
            memberMap.set(`placeholder:${nameKey}`, member);
        });

        // Sort by number of shared groups (most frequent first)
        return Array.from(memberMap.values()).sort(
            (a, b) => b.groups_shared - a.groups_shared
        );
    },
};

