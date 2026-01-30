import { SkeletonHeader, SkeletonList, LoadingCenter } from "@/components/ui/skeleton";

export default function ExpensesLoading() {
    return (
        <div className="space-y-6">
            <SkeletonHeader />
            <SkeletonList items={4} />
            <LoadingCenter label="Loading expenses..." size="md" />
        </div>
    );
}
