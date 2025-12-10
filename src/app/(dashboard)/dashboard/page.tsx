import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui";
import { signOut } from "@/app/(auth)/actions";
import { Wallet, LogOut } from "lucide-react";

export default async function DashboardPage() {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) {
        redirect("/login");
    }

    const user = data.user;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
            {/* Header */}
            <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-600">
                            <Wallet className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-xl font-bold text-gray-900 dark:text-white">
                            Smart<span className="text-teal-600">Split</span>
                        </span>
                    </div>

                    <form action={signOut}>
                        <Button variant="ghost" size="sm" type="submit">
                            <LogOut className="h-4 w-4" />
                            Sign Out
                        </Button>
                    </form>
                </div>
            </header>

            {/* Main content */}
            <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
                <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Welcome to SmartSplit! 🎉
                    </h1>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">
                        You&apos;re logged in as{" "}
                        <span className="font-medium text-gray-900 dark:text-white">
                            {user.email}
                        </span>
                    </p>

                    <div className="mt-8 rounded-lg bg-teal-50 p-4 dark:bg-teal-900/20">
                        <p className="text-sm text-teal-800 dark:text-teal-300">
                            <strong>Auth is working!</strong> This page is protected and only
                            visible to authenticated users.
                        </p>
                    </div>

                    <div className="mt-8">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            User Details
                        </h2>
                        <dl className="mt-4 space-y-3 text-sm">
                            <div className="flex gap-2">
                                <dt className="font-medium text-gray-500 dark:text-gray-400">
                                    User ID:
                                </dt>
                                <dd className="font-mono text-gray-900 dark:text-white">
                                    {user.id}
                                </dd>
                            </div>
                            <div className="flex gap-2">
                                <dt className="font-medium text-gray-500 dark:text-gray-400">
                                    Email:
                                </dt>
                                <dd className="text-gray-900 dark:text-white">{user.email}</dd>
                            </div>
                            <div className="flex gap-2">
                                <dt className="font-medium text-gray-500 dark:text-gray-400">
                                    Name:
                                </dt>
                                <dd className="text-gray-900 dark:text-white">
                                    {user.user_metadata?.full_name || "Not set"}
                                </dd>
                            </div>
                        </dl>
                    </div>
                </div>
            </main>
        </div>
    );
}

