import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { friendsServerService } from "@/services/friends.server";
import { FriendsList } from "@/components/features/friends/friends-list";

export default async function FriendsPage() {
    const supabase = await createClient();

    // Use getUser() - validates session with Supabase Auth server (secure)
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        redirect("/login");
    }

    // Pre-fetch data server-side - no client waterfall
    const members = await friendsServerService.getPastGroupMembers(user.id);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Friends
                </h1>
                <p className="mt-1 text-gray-500 dark:text-gray-400">
                    People you&apos;ve shared trips with - quickly add them to new groups
                </p>
            </div>

            <FriendsList initialMembers={members} />
        </div>
    );
}

