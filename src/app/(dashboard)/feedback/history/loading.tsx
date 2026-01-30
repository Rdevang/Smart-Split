import { Skeleton, LoadingCenter } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function FeedbackLoading() {
    return (
        <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
            <div>
                <Skeleton className="h-8 w-48" />
                <Skeleton className="mt-2 h-4 w-72" />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <Card key={i}>
                        <CardContent className="p-4 text-center">
                            <Skeleton className="h-8 w-12 mx-auto" />
                            <Skeleton className="mt-2 h-4 w-16 mx-auto" />
                        </CardContent>
                    </Card>
                ))}
            </div>

            <LoadingCenter label="Loading feedback..." />
        </div>
    );
}
