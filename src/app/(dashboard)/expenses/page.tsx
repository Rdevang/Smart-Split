import { redirect } from "next/navigation";
import Link from "next/link";
import { Receipt, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExpenseCard } from "@/components/features/expenses/expense-card";
import { expensesServerService } from "@/services/expenses.server";
import { groupsServerService } from "@/services/groups.server";

export default async function ExpensesPage() {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        redirect("/login");
    }

    const [groupsResult, expensesResult] = await Promise.all([
        groupsServerService.getGroups(user.id),
        expensesServerService.getUserExpenses(user.id, { limit: 20 }),
    ]);

    const groups = groupsResult.data;
    const recentExpenses = expensesResult.data;

    // Calculate totals
    const totalOwed = recentExpenses.reduce((sum, expense) => {
        if (expense.paid_by === user.id) {
            const othersOwe = expense.splits
                .filter((s) => s.user_id !== user.id && !s.is_settled)
                .reduce((s, split) => s + split.amount, 0);
            return sum + othersOwe;
        }
        return sum;
    }, 0);

    const totalOwe = recentExpenses.reduce((sum, expense) => {
        if (expense.paid_by !== user.id) {
            const userSplit = expense.splits.find((s) => s.user_id === user.id && !s.is_settled);
            return sum + (userSplit?.amount || 0);
        }
        return sum;
    }, 0);

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Expenses</h1>
                <p className="mt-1 text-gray-500 dark:text-gray-400">
                    View all your expenses across groups
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-2">
                <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
                    <CardContent className="p-6">
                        <p className="text-sm font-medium text-green-700 dark:text-green-300">You are owed</p>
                        <p className="mt-2 text-3xl font-bold text-green-600 dark:text-green-400">
                            ${totalOwed.toFixed(2)}
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
                    <CardContent className="p-6">
                        <p className="text-sm font-medium text-red-700 dark:text-red-300">You owe</p>
                        <p className="mt-2 text-3xl font-bold text-red-600 dark:text-red-400">
                            ${totalOwe.toFixed(2)}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Quick Add */}
            {groups.length > 0 && (
                <Card>
                    <CardContent className="p-6">
                        <h3 className="font-semibold text-gray-900 dark:text-white">Quick Add Expense</h3>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Select a group to add an expense
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                            {groups.slice(0, 5).map((group) => (
                                <Link key={group.id} href={`/groups/${group.id}/expenses/new`}>
                                    <Button variant="outline" size="sm">
                                        {group.name}
                                        <ArrowRight className="ml-2 h-3 w-3" />
                                    </Button>
                                </Link>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Expenses List */}
            <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Recent Expenses
                </h2>

                {recentExpenses.length === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center py-16">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                                <Receipt className="h-8 w-8 text-gray-400" />
                            </div>
                            <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                                No expenses yet
                            </h3>
                            <p className="mt-2 text-center text-gray-500 dark:text-gray-400">
                                {groups.length === 0
                                    ? "Create a group first to start adding expenses"
                                    : "Add your first expense to start tracking"}
                            </p>
                            {groups.length === 0 ? (
                                <Link href="/groups/new" className="mt-6">
                                    <Button>Create a Group</Button>
                                </Link>
                            ) : (
                                <Link href={`/groups/${groups[0].id}/expenses/new`} className="mt-6">
                                    <Button>Add First Expense</Button>
                                </Link>
                            )}
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
    );
}
