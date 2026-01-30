import { Skeleton, SkeletonText, SkeletonList, LoadingCenter } from "@/components/ui/skeleton";

export default function FriendsLoading() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <Skeleton className="h-8 w-32" />
                <Skeleton className="mt-2 h-4 w-64" />
            </div>

            {/* Search */}
            <Skeleton className="h-11 w-full" />

            {/* Cards */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div
                        key={i}
                        className="animate-pulse rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
                    >
                        <div className="flex items-center gap-3">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <SkeletonText lines={2} className="flex-1" />
                        </div>
                    </div>
                ))}
            </div>

            <LoadingCenter label="Loading friends..." size="md" />
        </div>
    );
}
