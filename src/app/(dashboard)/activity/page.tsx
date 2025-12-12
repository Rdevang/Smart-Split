import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { activitiesServerService } from "@/services/activities.server";
import { ActivityFeed } from "@/components/features/activity/activity-feed";

export default async function ActivityPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const activities = await activitiesServerService.getUserActivities(user.id);

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

            <ActivityFeed activities={activities} showGroupName />
        </div>
    );
}
