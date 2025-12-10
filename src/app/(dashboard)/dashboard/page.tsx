import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { Users, Receipt, TrendingUp, TrendingDown } from "lucide-react";

export default async function DashboardPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // TODO: Fetch actual stats from database
    const stats = [
        {
            title: "Total Balance",
            value: "$0.00",
            description: "You're all settled up!",
            icon: TrendingUp,
            color: "text-green-600",
            bgColor: "bg-green-100 dark:bg-green-900/30",
        },
        {
            title: "You Owe",
            value: "$0.00",
            description: "No pending debts",
            icon: TrendingDown,
            color: "text-red-600",
            bgColor: "bg-red-100 dark:bg-red-900/30",
        },
        {
            title: "Groups",
            value: "0",
            description: "Create your first group",
            icon: Users,
            color: "text-blue-600",
            bgColor: "bg-blue-100 dark:bg-blue-900/30",
        },
        {
            title: "Expenses",
            value: "0",
            description: "This month",
            icon: Receipt,
            color: "text-purple-600",
            bgColor: "bg-purple-100 dark:bg-purple-900/30",
        },
    ];

    return (
        <div className="space-y-8">
            {/* Welcome section */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Welcome back, {user?.user_metadata?.full_name?.split(" ")[0] || "there"}! 👋
                </h1>
                <p className="mt-1 text-gray-600 dark:text-gray-400">
                    Here&apos;s an overview of your expenses and balances.
                </p>
            </div>

            {/* Stats grid */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat) => (
                    <Card key={stat.title}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                {stat.title}
                            </CardTitle>
                            <div className={`rounded-lg p-2 ${stat.bgColor}`}>
                                <stat.icon className={`h-4 w-4 ${stat.color}`} />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                {stat.value}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {stat.description}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Recent activity section */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Recent expenses */}
                <Card>
                    <CardHeader>
                        <CardTitle>Recent Expenses</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <Receipt className="h-12 w-12 text-gray-300 dark:text-gray-600" />
                            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                                No expenses yet
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">
                                Add your first expense to get started
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Your groups */}
                <Card>
                    <CardHeader>
                        <CardTitle>Your Groups</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <Users className="h-12 w-12 text-gray-300 dark:text-gray-600" />
                            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                                No groups yet
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">
                                Create a group to start splitting expenses
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
