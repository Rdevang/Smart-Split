import { Spinner } from "@/components/ui/spinner";

export default function SettingsLoading() {
    return (
        <div className="space-y-6">
            {/* Header skeleton */}
            <div className="h-8 w-32 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" />

            {/* Settings cards skeleton */}
            <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                    <div
                        key={i}
                        className="animate-pulse rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
                    >
                        <div className="flex items-center justify-between">
                            <div className="space-y-2">
                                <div className="h-5 w-32 rounded bg-gray-200 dark:bg-gray-800" />
                                <div className="h-4 w-48 rounded bg-gray-200 dark:bg-gray-800" />
                            </div>
                            <div className="h-9 w-20 rounded-lg bg-gray-200 dark:bg-gray-800" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Center spinner */}
            <div className="flex justify-center py-8">
                <Spinner size="lg" label="Loading settings..." />
            </div>
        </div>
    );
}

