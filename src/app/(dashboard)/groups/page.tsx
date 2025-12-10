import { Button } from "@/components/ui";
import { Plus, Users } from "lucide-react";

export default function GroupsPage() {
    return (
        <div>
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Groups
                    </h1>
                    <p className="mt-1 text-gray-600 dark:text-gray-400">
                        Manage your expense sharing groups
                    </p>
                </div>
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    New Group
                </Button>
            </div>

            {/* Empty state */}
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-16 dark:border-gray-800">
                <div className="rounded-full bg-gray-100 p-4 dark:bg-gray-800">
                    <Users className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                    No groups yet
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Create your first group to start splitting expenses
                </p>
                <Button className="mt-6">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Group
                </Button>
            </div>
        </div>
    );
}

