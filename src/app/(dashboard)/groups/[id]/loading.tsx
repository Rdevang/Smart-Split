import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function GroupDetailLoading() {
    return (
        <div className="space-y-6">
            {/* Back button skeleton */}
            <div className="h-5 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />

            {/* Header skeleton */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                    <div className="h-16 w-16 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
                    <div className="space-y-2">
                        <div className="h-7 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                        <div className="h-4 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                    </div>
                </div>
                <div className="h-10 w-10 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" />
            </div>

            {/* Stats cards skeleton */}
            <div className="grid gap-4 sm:grid-cols-3">
                {[1, 2, 3].map((i) => (
                    <Card key={i} className="animate-pulse">
                        <CardContent className="p-4">
                            <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-800" />
                            <div className="mt-2 h-7 w-20 rounded bg-gray-200 dark:bg-gray-800" />
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Members section skeleton */}
            <Card className="animate-pulse">
                <CardHeader>
                    <div className="h-5 w-20 rounded bg-gray-200 dark:bg-gray-800" />
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-800" />
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Loading indicator */}
            <div className="flex items-center justify-center py-8">
                <Spinner size="lg" label="Loading group..." />
            </div>
        </div>
    );
}

