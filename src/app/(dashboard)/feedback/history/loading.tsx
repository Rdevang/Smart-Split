import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export default function FeedbackLoading() {
    return (
        <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
            <div>
                <div className="h-8 w-48 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" />
                <div className="mt-2 h-4 w-72 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
            </div>

            {/* Stats Skeleton */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <Card key={i}>
                        <CardContent className="p-4 text-center">
                            <div className="h-8 w-12 mx-auto animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                            <div className="mt-2 h-4 w-16 mx-auto animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Feedback List Skeleton */}
            <div className="flex justify-center py-8">
                <Spinner size="lg" variant="muted" />
            </div>
        </div>
    );
}

