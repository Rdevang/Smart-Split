import { Skeleton, SkeletonCard, LoadingCenter } from "@/components/ui/skeleton";

export default function SettingsLoading() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-8 w-32" />

            {/* Settings cards skeleton */}
            <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                    <SkeletonCard key={i} withAvatar={false} withAction textLines={2} />
                ))}
            </div>

            <LoadingCenter label="Loading settings..." />
        </div>
    );
}
