import { Spinner } from "@/components/ui/spinner";

export default function JoinGroupLoading() {
    return (
        <div className="flex min-h-[60vh] items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <Spinner size="lg" />
                <p className="text-gray-500 dark:text-gray-400">Loading...</p>
            </div>
        </div>
    );
}

