import { createClient } from "@/lib/supabase/client";

export interface PastMember {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
    is_placeholder: boolean;
    groups_shared: number; // Number of groups you've been in together
}

export const friendsService = {
    /**
     * Get all people you've been in groups with (past co-members)
     * These are your "friends" that you can quickly add to new groups
     */
    async getPastGroupMembers(userId: string): Promise<PastMember[]> {
        const supabase = createClient();

        // Get all groups the user is part of
        const { data: userGroups } = await supabase
            .from("group_members")
            .select("group_id")
            .eq("user_id", userId);

        if (!userGroups || userGroups.length === 0) {
            return [];
        }

        const groupIds = userGroups.map((g) => g.group_id);

        // Get all members from those groups (excluding current user)
        // For real users
        const { data: realMembers } = await supabase
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
            .neq("user_id", userId);

        // For placeholder members
        const { data: placeholderMembers } = await supabase
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
            .not("placeholder_id", "is", null);

        // Aggregate real members by user
        const memberMap = new Map<string, PastMember>();

        (realMembers || []).forEach((m) => {
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

        // Aggregate placeholder members - deduplicate by name (case-insensitive)
        // Since placeholders can have different IDs across groups but same name
        const placeholderByName = new Map<string, PastMember>();

        (placeholderMembers || []).forEach((m) => {
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

        // Add deduplicated placeholders to memberMap
        placeholderByName.forEach((member, nameKey) => {
            memberMap.set(`placeholder:${nameKey}`, member);
        });

        // Sort by number of shared groups (most frequent first)
        return Array.from(memberMap.values()).sort(
            (a, b) => b.groups_shared - a.groups_shared
        );
    },

    /**
     * Search past members by name or email
     */
    async searchPastMembers(userId: string, query: string): Promise<PastMember[]> {
        const allMembers = await this.getPastGroupMembers(userId);
        const lowerQuery = query.toLowerCase();

        return allMembers.filter(
            (m) =>
                m.name.toLowerCase().includes(lowerQuery) ||
                m.email.toLowerCase().includes(lowerQuery)
        );
    },
};
