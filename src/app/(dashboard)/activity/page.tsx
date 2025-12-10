import { Bell } from "lucide-react";

export default function ActivityPage() {
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

            {/* Empty state */}
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-16 dark:border-gray-800">
                <div className="rounded-full bg-gray-100 p-4 dark:bg-gray-800">
                    <Bell className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                    No activity yet
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Activity will appear here when you start using groups
                </p>
            </div>
        </div>
    );
}

