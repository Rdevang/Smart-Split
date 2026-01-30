import { Skeleton, SkeletonAvatar, SkeletonCard, LoadingCenter } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function GroupDetailLoading() {
    return (
        <div className="space-y-6">
            {/* Back button */}
            <Skeleton className="h-5 w-24" />

            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                    <SkeletonAvatar size="xl" shape="rounded" />
                    <div className="space-y-2">
                        <Skeleton className="h-7 w-48" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                </div>
                <Skeleton className="h-10 w-10" />
            </div>

            {/* Stats cards */}
            <div className="grid gap-4 sm:grid-cols-3">
                {[1, 2, 3].map((i) => (
                    <Card key={i} className="animate-pulse">
                        <CardContent className="p-4">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="mt-2 h-7 w-20" />
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Members section */}
            <Card className="animate-pulse">
                <CardHeader>
                    <Skeleton className="h-5 w-20" />
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2">
                        {[1, 2, 3, 4].map((i) => (
                            <SkeletonAvatar key={i} size="md" />
                        ))}
                    </div>
                </CardContent>
            </Card>

            <LoadingCenter label="Loading group..." />
        </div>
    );
}
