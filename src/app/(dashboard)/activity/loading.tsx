import { Skeleton, SkeletonList, LoadingCenter } from "@/components/ui/skeleton";

export default function ActivityLoading() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-8 w-32" />
            <SkeletonList items={5} />
            <LoadingCenter label="Loading activity..." size="md" />
        </div>
    );
}
