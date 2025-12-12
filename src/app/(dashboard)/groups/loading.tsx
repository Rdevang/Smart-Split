import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent } from "@/components/ui/card";

export default function GroupsLoading() {
    return (
        <div className="space-y-6">
            {/* Header skeleton */}
            <div className="flex items-center justify-between">
                <div className="h-8 w-32 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" />
                <div className="h-10 w-32 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" />
            </div>

            {/* Cards skeleton */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                    <Card key={i} className="animate-pulse">
                        <CardContent className="p-5">
                            <div className="flex items-start gap-4">
                                <div className="h-12 w-12 rounded-xl bg-gray-200 dark:bg-gray-800" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-5 w-3/4 rounded bg-gray-200 dark:bg-gray-800" />
                                    <div className="h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-800" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Center spinner for longer loads */}
            <div className="flex justify-center py-8">
                <Spinner size="md" variant="muted" />
            </div>
        </div>
    );
}

