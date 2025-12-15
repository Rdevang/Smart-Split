import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Users, QrCode } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { GroupCard } from "@/components/features/groups/group-card";
import { groupsServerService } from "@/services/groups.server";

export default async function GroupsPage() {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        redirect("/login");
    }

    const groupsResult = await groupsServerService.getGroups(user.id);
    const groups = groupsResult.data;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Groups</h1>
                    <p className="mt-1 text-gray-500 dark:text-gray-400">
                        Manage your expense sharing groups
                    </p>
                </div>
                <div className="flex gap-2">
                    <Link href="/groups/join">
                        <Button variant="outline">
                            <QrCode className="mr-2 h-4 w-4" />
                            Join Group
                        </Button>
                    </Link>
                    <Link href="/groups/new">
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            New Group
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Groups List */}
            {groups.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-16 dark:border-gray-700 dark:bg-gray-900/50">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900/30">
                        <Users className="h-8 w-8 text-teal-600 dark:text-teal-400" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                        No groups yet
                    </h3>
                    <p className="mt-2 text-center text-gray-500 dark:text-gray-400">
                        Create your first group to start splitting expenses<br />with friends, roommates, or anyone.
                    </p>
                    <div className="mt-6 flex gap-3">
                        <Link href="/groups/join">
                            <Button variant="outline">
                                <QrCode className="mr-2 h-4 w-4" />
                                Join with Code
                            </Button>
                        </Link>
                        <Link href="/groups/new">
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Create Group
                            </Button>
                        </Link>
                    </div>
                </div>
            ) : (
                <div className="grid gap-4">
                    {groups.map((group) => (
                        <GroupCard key={group.id} group={group} />
                    ))}
                </div>
            )}
        </div>
    );
}
