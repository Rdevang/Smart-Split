import { redirect } from "next/navigation";
import Link from "next/link";
import {
    Plus, Users, Receipt, TrendingUp, TrendingDown,
    ArrowRight, QrCode
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GroupCard } from "@/components/features/groups/group-card";
import { ExpenseCard } from "@/components/features/expenses/expense-card";
import { PendingSettlements } from "@/components/features/groups/pending-settlements";
import { groupsServerService } from "@/services/groups.server";
import { expensesServerService } from "@/services/expenses.server";

export default async function DashboardPage() {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        redirect("/login");
    }

    // Fetch data in parallel
    const [groupsResult, recentExpenses, profile] = await Promise.all([
        groupsServerService.getGroups(user.id),
        expensesServerService.getRecentExpenses(user.id, 5),
        supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    ]);

    const groups = groupsResult.data;

    // Calculate summary stats from ALL group balances (not just recent expenses)
    // Fetch balances for all groups the user is in
    const balancePromises = groups.map((group) =>
        groupsServerService.getGroupBalances(group.id)
    );
    const allGroupBalances = await Promise.all(balancePromises);

    let totalOwed = 0;
    let totalOwe = 0;

    // Sum up user's balance across all groups
    allGroupBalances.forEach((balances) => {
        const userBalance = balances.find((b) => b.user_id === user.id);
        if (userBalance) {
            if (userBalance.balance > 0) {
                // Positive balance means others owe the user
                totalOwed += userBalance.balance;
            } else {
                // Negative balance means user owes others
                totalOwe += Math.abs(userBalance.balance);
            }
        }
    });

    const netBalance = totalOwed - totalOwe;
    const firstName = profile.data?.full_name?.split(" ")[0] || "there";

    return (
        <div className="space-y-8">
            {/* Welcome Header */}
            <div className="flex flex-col gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                        Welcome back, {firstName}! 👋
                    </h1>
                    <p className="mt-1 text-sm sm:text-base text-gray-500 dark:text-gray-400">
                        Here&apos;s what&apos;s happening with your expenses
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link href="/groups/join">
                        <Button variant="outline" size="sm" className="text-xs sm:text-sm">
                            <QrCode className="mr-1.5 h-4 w-4" />
                            <span className="hidden xs:inline">Join</span>
                            <span className="xs:hidden">Join</span>
                        </Button>
                    </Link>
                    <Link href="/groups/new">
                        <Button variant="outline" size="sm" className="text-xs sm:text-sm">
                            <Users className="mr-1.5 h-4 w-4" />
                            <span className="hidden xs:inline">New Group</span>
                            <span className="xs:hidden">New</span>
                        </Button>
                    </Link>
                    {groups.length > 0 && (
                        <Link href={`/groups/${groups[0].id}/expenses/new`}>
                            <Button size="sm" className="text-xs sm:text-sm">
                                <Plus className="mr-1.5 h-4 w-4" />
                                <span className="hidden sm:inline">Add Expense</span>
                                <span className="sm:hidden">Expense</span>
                            </Button>
                        </Link>
                    )}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardContent className="flex items-center gap-4 p-6">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/30">
                            <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">You are owed</p>
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                                ${totalOwed.toFixed(2)}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="flex items-center gap-4 p-6">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/30">
                            <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">You owe</p>
                            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                                ${totalOwe.toFixed(2)}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="flex items-center gap-4 p-6">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${netBalance >= 0
                            ? "bg-teal-100 dark:bg-teal-900/30"
                            : "bg-orange-100 dark:bg-orange-900/30"
                            }`}>
                            <Receipt className={`h-6 w-6 ${netBalance >= 0
                                ? "text-teal-600 dark:text-teal-400"
                                : "text-orange-600 dark:text-orange-400"
                                }`} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Net Balance</p>
                            <p className={`text-2xl font-bold ${netBalance >= 0
                                ? "text-teal-600 dark:text-teal-400"
                                : "text-orange-600 dark:text-orange-400"
                                }`}>
                                {netBalance >= 0 ? "+" : ""}{netBalance.toFixed(2)}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="flex items-center gap-4 p-6">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
                            <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Active Groups</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {groups.length}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Pending Settlement Approvals */}
            <PendingSettlements userId={user.id} />

            <div className="grid gap-8 lg:grid-cols-3">
                {/* Recent Groups */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Your Groups
                        </h2>
                        <Link href="/groups" className="text-sm text-teal-600 hover:text-teal-700 dark:text-teal-400">
                            View all <ArrowRight className="ml-1 inline h-4 w-4" />
                        </Link>
                    </div>

                    {groups.length === 0 ? (
                        <Card>
                            <CardContent className="flex flex-col items-center py-12">
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900/30">
                                    <Users className="h-8 w-8 text-teal-600 dark:text-teal-400" />
                                </div>
                                <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                                    No groups yet
                                </h3>
                                <p className="mt-2 text-center text-gray-500 dark:text-gray-400">
                                    Create your first group to start<br />splitting expenses with friends.
                                </p>
                                <div className="mt-6 flex gap-3">
                                    <Link href="/groups/join">
                                        <Button variant="outline">
                                            <QrCode className="mr-2 h-4 w-4" />
                                            Join with Code
                                        </Button>
                                    </Link>
                                    <Link href="/groups/new">
                                        <Button>
                                            <Plus className="mr-2 h-4 w-4" />
                                            Create Group
                                        </Button>
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4">
                            {groups.slice(0, 3).map((group) => (
                                <GroupCard key={group.id} group={group} />
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent Expenses */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Recent Expenses
                        </h2>
                        <Link href="/expenses" className="text-sm text-teal-600 hover:text-teal-700 dark:text-teal-400">
                            View all <ArrowRight className="ml-1 inline h-4 w-4" />
                        </Link>
                    </div>

                    {recentExpenses.length === 0 ? (
                        <Card>
                            <CardContent className="flex flex-col items-center py-8">
                                <Receipt className="h-10 w-10 text-gray-300 dark:text-gray-600" />
                                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                                    No expenses yet
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {recentExpenses.map((expense) => (
                                <ExpenseCard
                                    key={expense.id}
                                    expense={expense}
                                    currentUserId={user.id}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
