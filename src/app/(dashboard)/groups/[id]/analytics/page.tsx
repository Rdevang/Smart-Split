import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, PieChart, TrendingUp, Users, Wallet, Activity, BarChart3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { groupsCachedServerService } from "@/services/groups.cached.server";
import { expensesCachedServerService } from "@/services/expenses.cached.server";
import { formatCurrency } from "@/lib/currency";
import { decryptUrlId, encryptUrlId } from "@/lib/url-ids";
import {
    CategoryChart,
    TrendChart,
    ContributionsChart,
    BalancesChart,
    SpendByMemberChart,
} from "@/components/features/groups/analytics-charts";

interface AnalyticsPageProps {
    params: Promise<{ id: string }>;
}

export default async function AnalyticsPage({ params }: AnalyticsPageProps) {
    const { id: encryptedId } = await params;
    // Decrypt URL ID to get real database UUID
    const id = decryptUrlId(encryptedId);
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        redirect("/login");
    }

    // Using CACHED services for lightning-fast analytics loading
    const [group, expensesResult, balances] = await Promise.all([
        groupsCachedServerService.getGroup(id),
        expensesCachedServerService.getExpenses(id),
        groupsCachedServerService.getGroupBalances(id),
    ]);

    if (!group) {
        notFound();
    }

    const expenses = expensesResult.data;
    const currency = group.currency || "USD";
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const avgExpense = expenses.length > 0 ? totalExpenses / expenses.length : 0;

    // Calculate category count
    const categories = new Set(expenses.map(e => e.category || "other"));

    // Calculate top spender
    const spenderMap = new Map<string, { name: string; amount: number }>();
    expenses.forEach((expense) => {
        const payerId = expense.paid_by || expense.paid_by_placeholder?.id || "unknown";
        // Check both profile and placeholder for the name
        const payerName = expense.paid_by_profile?.full_name
            || expense.paid_by_placeholder?.name
            || "Unknown";
        if (!spenderMap.has(payerId)) {
            spenderMap.set(payerId, { name: payerName, amount: 0 });
        }
        const current = spenderMap.get(payerId)!;
        current.amount += expense.amount;
    });
    const topSpender = Array.from(spenderMap.values()).sort((a, b) => b.amount - a.amount)[0];

    return (
        <div className="space-y-8">
            {/* Back Link */}
            <Link
                href={`/groups/${encryptUrlId(id)}`}
                className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to {group.name}
            </Link>

            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Analytics
                    </h1>
                    <p className="mt-1 text-gray-500 dark:text-gray-400">
                        Expense insights for {group.name}
                    </p>
                </div>
                <Badge variant="primary" className="self-start text-base px-4 py-2">
                    {formatCurrency(totalExpenses, currency)} Total
                </Badge>
            </div>

            {expenses.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center py-16">
                        <PieChart className="h-16 w-16 text-gray-300 dark:text-gray-600" />
                        <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                            No expenses yet
                        </h3>
                        <p className="mt-2 text-center text-gray-500 dark:text-gray-400">
                            Add some expenses to see analytics
                        </p>
                        <Link href={`/groups/${encryptUrlId(id)}/expenses/new`} className="mt-6">
                            <Button>Add First Expense</Button>
                        </Link>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* Summary Stats */}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardContent className="p-6">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/30">
                                        <Wallet className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Total Expenses</p>
                                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                                            {expenses.length}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-6">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                                        <PieChart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Categories</p>
                                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                                            {categories.size}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-6">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                                        <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Avg per Expense</p>
                                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                                            {formatCurrency(avgExpense, currency)}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-6">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
                                        <Users className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Top Spender</p>
                                        <p className="text-lg font-bold text-gray-900 dark:text-white truncate max-w-[120px]">
                                            {topSpender?.name.split(" ")[0] || "N/A"}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Charts Grid */}
                    <div className="grid gap-6 lg:grid-cols-2">
                        {/* Category Breakdown - Donut Chart */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <PieChart className="h-5 w-5 text-orange-500" />
                                    Expenses by Category
                                    <span className="ml-auto text-xs font-normal text-gray-400">Donut Chart</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <CategoryChart expenses={expenses} currency={currency} />
                            </CardContent>
                        </Card>

                        {/* Spending Trend - Line Chart */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <TrendingUp className="h-5 w-5 text-blue-500" />
                                    Spending Over Time
                                    <span className="ml-auto text-xs font-normal text-gray-400">Line Chart</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <TrendChart expenses={expenses} currency={currency} />
                            </CardContent>
                        </Card>

                        {/* Member Contributions - Horizontal Bar Chart */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Wallet className="h-5 w-5 text-teal-500" />
                                    Who Paid What
                                    <span className="ml-auto text-xs font-normal text-gray-400">Bar Chart</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ContributionsChart expenses={expenses} currency={currency} />
                            </CardContent>
                        </Card>

                        {/* Spend by Member - Radar Chart */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Activity className="h-5 w-5 text-purple-500" />
                                    Spend by Member
                                    <span className="ml-auto text-xs font-normal text-gray-400">Radar Chart</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <SpendByMemberChart
                                    expenses={expenses}
                                    currency={currency}
                                    currentUserId={user.id}
                                />
                            </CardContent>
                        </Card>

                        {/* Member Balances - Vertical Bar Chart (Full Width) */}
                        <Card className="lg:col-span-2">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <BarChart3 className="h-5 w-5 text-green-500" />
                                    Member Balances
                                    <span className="ml-auto text-xs font-normal text-gray-400">Column Chart</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <BalancesChart
                                    balances={balances}
                                    currency={currency}
                                    currentUserId={user.id}
                                />
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}
        </div>
    );
}

