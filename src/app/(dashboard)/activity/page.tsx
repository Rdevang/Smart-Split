import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { activitiesServerService } from "@/services/activities.server";
import { ActivityPageClient } from "@/components/features/activity/activity-page-client";
import { encryptUrlId } from "@/lib/url-ids";

const INITIAL_PAGE_SIZE = 20;

export default async function ActivityPage() {
    const supabase = await createClient();
    // Layout already verified auth - use getSession() for speed
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
        redirect("/login");
    }
    const user = session.user;

    // Fetch initial data in parallel
    const [activitiesData, userGroups, uniqueMembers] = await Promise.all([
        // Initial activities (first page)
        activitiesServerService.getUserActivities(user.id, INITIAL_PAGE_SIZE),

        // Get user's groups for filter dropdown
        supabase
            .from("group_members")
            .select(`
                group:groups (
                    id,
                    name
                )
            `)
            .eq("user_id", user.id),

        // Get unique members from user's groups for filter dropdown
        (async () => {
            const { data: memberships } = await supabase
                .from("group_members")
                .select("group_id")
                .eq("user_id", user.id);

            if (!memberships || memberships.length === 0) {
                return [];
            }

            const groupIds = memberships.map((m) => m.group_id);

            const { data: members } = await supabase
                .from("group_members")
                .select(`
                    user_id,
                    profile:profiles (
                        id,
                        full_name
                    )
                `)
                .in("group_id", groupIds)
                .not("user_id", "is", null);

            // Deduplicate members
            const memberMap = new Map<string, { id: string; name: string }>();
            (members || []).forEach((m) => {
                const profile = m.profile as unknown as { id: string; full_name: string | null } | null;
                if (profile && !memberMap.has(profile.id)) {
                    memberMap.set(profile.id, {
                        id: profile.id,
                        name: profile.full_name || "Unknown",
                    });
                }
            });

            return Array.from(memberMap.values());
        })(),
    ]);

    const activities = activitiesData || [];

    // Pre-encrypt group IDs for secure URLs
    const encryptedGroupIds: Record<string, string> = {};
    activities.forEach(activity => {
        if (activity.group?.id && !encryptedGroupIds[activity.group.id]) {
            encryptedGroupIds[activity.group.id] = encryptUrlId(activity.group.id);
        }
    });

    // Transform groups for filter dropdown
    const groups = (userGroups.data || [])
        .map((m) => {
            const group = m.group as unknown as { id: string; name: string } | null;
            return group ? { id: group.id, name: group.name } : null;
        })
        .filter((g): g is { id: string; name: string } => g !== null);

    // Get total count for "hasMore" calculation
    const { count: totalCount } = await supabase
        .from("activities")
        .select("*", { count: "exact", head: true })
        .in("group_id", groups.map((g) => g.id));

    const hasMore = activities.length < (totalCount || 0);

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Activity
                </h1>
                <p className="mt-1 text-gray-600 dark:text-gray-400">
                    See recent activity from your groups
                </p>
            </div>

            <ActivityPageClient
                initialActivities={activities}
                initialEncryptedGroupIds={encryptedGroupIds}
                initialTotalCount={totalCount || 0}
                initialHasMore={hasMore}
                groups={groups}
                members={uniqueMembers}
            />
        </div>
    );
}
