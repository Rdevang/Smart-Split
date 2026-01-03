import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { activitiesServerService } from "@/services/activities.server";
import { friendsCachedServerService } from "@/services/friends.cached.server";
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
    const [activitiesData, userGroups, pastMembers, userProfile] = await Promise.all([
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

        // Get all people user has been in groups with (cached)
        friendsCachedServerService.getPastGroupMembers(user.id),

        // Get current user's profile for "You" option
        supabase
            .from("profiles")
            .select("full_name")
            .eq("id", user.id)
            .single(),
    ]);

    // Build members list with "You" at the top
    const currentUserName = userProfile.data?.full_name || user.email || "You";
    const members = [
        { id: user.id, name: `You (${currentUserName})` },
        ...pastMembers,
    ];

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
                members={members}
            />
        </div>
    );
}
