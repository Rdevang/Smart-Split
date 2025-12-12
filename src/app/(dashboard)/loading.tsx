import { Spinner } from "@/components/ui/spinner";

export default function DashboardLoading() {
    return (
        <div className="flex min-h-[50vh] items-center justify-center">
            <div className="flex flex-col items-center gap-3">
                <Spinner size="lg" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
            </div>
        </div>
    );
}

