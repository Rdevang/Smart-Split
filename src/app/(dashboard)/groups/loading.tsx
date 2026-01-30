import { SkeletonHeader, SkeletonCard, LoadingCenter } from "@/components/ui/skeleton";

export default function GroupsLoading() {
    return (
        <div className="space-y-6">
            <SkeletonHeader />

            {/* Cards skeleton */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                    <SkeletonCard key={i} textLines={2} />
                ))}
            </div>

            <LoadingCenter label="Loading groups..." size="md" />
        </div>
    );
}
