import { Spinner } from "@/components/ui/spinner";

export default function FriendsLoading() {
    return (
        <div className="space-y-6">
            {/* Header skeleton */}
            <div>
                <div className="h-8 w-32 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" />
                <div className="mt-2 h-4 w-64 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
            </div>

            {/* Search skeleton */}
            <div className="h-11 w-full animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" />

            {/* Cards skeleton */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div
                        key={i}
                        className="animate-pulse rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
                    >
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-800" />
                            <div className="space-y-2 flex-1">
                                <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-800" />
                                <div className="h-3 w-32 rounded bg-gray-200 dark:bg-gray-800" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex justify-center py-4">
                <Spinner size="md" label="Loading friends..." />
            </div>
        </div>
    );
}

