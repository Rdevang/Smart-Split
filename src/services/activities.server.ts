import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Activity = Database["public"]["Tables"]["activities"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Group = Database["public"]["Tables"]["groups"]["Row"];

export interface ActivityWithDetails extends Activity {
    user_profile: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
    group: Pick<Group, "id" | "name"> | null;
}

export const activitiesServerService = {
    /**
     * Get activities for a user (from all their groups)
     */
    async getUserActivities(userId: string, limit = 50): Promise<ActivityWithDetails[]> {
        const supabase = await createClient();

        // Get user's group IDs
        const { data: memberships } = await supabase
            .from("group_members")
            .select("group_id")
            .eq("user_id", userId);

        if (!memberships || memberships.length === 0) {
            return [];
        }

        const groupIds = memberships.map((m) => m.group_id);

        // Get activities from those groups
        const { data: activities, error } = await supabase
            .from("activities")
            .select(`
                *,
                user_profile:profiles!activities_user_id_fkey (
                    id,
                    full_name,
                    avatar_url
                ),
                group:groups (
                    id,
                    name
                )
            `)
            .in("group_id", groupIds)
            .order("created_at", { ascending: false })
            .limit(limit);

        if (error || !activities) {
            console.error("Error fetching activities:", error);
            return [];
        }

        return activities.map((activity) => ({
            ...activity,
            user_profile: activity.user_profile as ActivityWithDetails["user_profile"],
            group: activity.group as ActivityWithDetails["group"],
        }));
    },

    /**
     * Get activities for a specific group
     */
    async getGroupActivities(groupId: string, limit = 50): Promise<ActivityWithDetails[]> {
        const supabase = await createClient();

        const { data: activities, error } = await supabase
            .from("activities")
            .select(`
                *,
                user_profile:profiles!activities_user_id_fkey (
                    id,
                    full_name,
                    avatar_url
                ),
                group:groups (
                    id,
                    name
                )
            `)
            .eq("group_id", groupId)
            .order("created_at", { ascending: false })
            .limit(limit);

        if (error || !activities) {
            console.error("Error fetching group activities:", error);
            return [];
        }

        return activities.map((activity) => ({
            ...activity,
            user_profile: activity.user_profile as ActivityWithDetails["user_profile"],
            group: activity.group as ActivityWithDetails["group"],
        }));
    },
};

