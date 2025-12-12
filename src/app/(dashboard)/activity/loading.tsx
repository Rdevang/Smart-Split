import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent } from "@/components/ui/card";

export default function ActivityLoading() {
    return (
        <div className="space-y-6">
            {/* Header skeleton */}
            <div className="h-8 w-32 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" />

            {/* Activity items skeleton */}
            <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                    <Card key={i} className="animate-pulse">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-800" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-800" />
                                    <div className="h-3 w-1/3 rounded bg-gray-200 dark:bg-gray-800" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Center spinner */}
            <div className="flex justify-center py-4">
                <Spinner size="md" variant="muted" />
            </div>
        </div>
    );
}

