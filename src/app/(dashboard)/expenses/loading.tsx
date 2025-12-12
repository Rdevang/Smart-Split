import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent } from "@/components/ui/card";

export default function ExpensesLoading() {
    return (
        <div className="space-y-6">
            {/* Header skeleton */}
            <div className="flex items-center justify-between">
                <div className="h-8 w-36 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" />
                <div className="h-10 w-36 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" />
            </div>

            {/* Expense cards skeleton */}
            <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                    <Card key={i} className="animate-pulse">
                        <CardContent className="p-4">
                            <div className="flex items-start gap-4">
                                <div className="h-10 w-10 rounded-lg bg-gray-200 dark:bg-gray-800" />
                                <div className="flex-1 space-y-2">
                                    <div className="flex justify-between">
                                        <div className="h-5 w-40 rounded bg-gray-200 dark:bg-gray-800" />
                                        <div className="h-5 w-16 rounded bg-gray-200 dark:bg-gray-800" />
                                    </div>
                                    <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-800" />
                                    <div className="mt-2 flex gap-2">
                                        {[1, 2, 3].map((j) => (
                                            <div key={j} className="h-6 w-20 rounded-full bg-gray-200 dark:bg-gray-800" />
                                        ))}
                                    </div>
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

