import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { activitiesServerService } from "@/services/activities.server";
import { ActivityFeed } from "@/components/features/activity/activity-feed";
import { encryptUrlId } from "@/lib/url-ids";

export default async function ActivityPage() {
    const supabase = await createClient();
    // Layout already verified auth - use getSession() for speed
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
        redirect("/login");
    }
    const user = session.user;

    const activities = await activitiesServerService.getUserActivities(user.id) || [];

    // Pre-encrypt group IDs for secure URLs
    const encryptedGroupIds: Record<string, string> = {};
    activities.forEach(activity => {
        if (activity.group?.id && !encryptedGroupIds[activity.group.id]) {
            encryptedGroupIds[activity.group.id] = encryptUrlId(activity.group.id);
        }
    });

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

            <ActivityFeed 
                activities={activities} 
                showGroupName 
                encryptedGroupIds={encryptedGroupIds}
            />
        </div>
    );
}
