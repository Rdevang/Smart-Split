import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft, TrendingUp, TrendingDown, Users, Wallet, Receipt,
    Calendar, Target, Sparkles, BarChart3, PieChart, Activity
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
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
    DailyBreakdownChart,
    TopExpensesList,
} from "@/components/features/groups/analytics-charts";

interface AnalyticsPageProps {
    params: Promise<{ id: string }>;
}

export default async function AnalyticsPage({ params }: AnalyticsPageProps) {
    const { id: encryptedId } = await params;
    const id = decryptUrlId(encryptedId);
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        redirect("/login");
    }

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

    // Calculate insights
    const categories = new Set(expenses.map(e => e.category || "other"));
    
    // Top spender
    const spenderMap = new Map<string, { name: string; amount: number }>();
    expenses.forEach((expense) => {
        const payerId = expense.paid_by || expense.paid_by_placeholder?.id || "unknown";
        const payerName = expense.paid_by_profile?.full_name
            || expense.paid_by_placeholder?.name
            || "Unknown";
        if (!spenderMap.has(payerId)) {
            spenderMap.set(payerId, { name: payerName, amount: 0 });
        }
        spenderMap.get(payerId)!.amount += expense.amount;
    });
    const topSpender = Array.from(spenderMap.values()).sort((a, b) => b.amount - a.amount)[0];

    // Biggest expense
    const biggestExpense = expenses.length > 0
        ? expenses.reduce((max, e) => e.amount > max.amount ? e : max, expenses[0])
        : null;

    // This month vs last month
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const thisMonthExpenses = expenses.filter(e => {
        const d = new Date(e.expense_date || "");
        return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });
    const thisMonthTotal = thisMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;
    const lastMonthExpenses = expenses.filter(e => {
        const d = new Date(e.expense_date || "");
        return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
    });
    const lastMonthTotal = lastMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
    const monthlyChange = lastMonthTotal > 0
        ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100
        : 0;

    return (
        <div className="space-y-6">
            {/* Back Link */}
            <Link
                href={`/groups/${encryptUrlId(id)}`}
                className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to {group.name}
            </Link>

            {/* Header with Gradient */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-500 via-teal-600 to-emerald-600 p-6 text-white">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIyIi8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
                <div className="relative">
                    <div className="flex items-center gap-2 text-teal-100 mb-2">
                        <Sparkles className="h-4 w-4" />
                        <span className="text-sm font-medium">Analytics Dashboard</span>
                    </div>
                    <h1 className="text-3xl font-bold">{group.name}</h1>
                    <p className="mt-1 text-teal-100">
                        {expenses.length} expenses • {group.members.length} members
                    </p>
                </div>
                <div className="absolute top-6 right-6">
                    <div className="text-right">
                        <p className="text-sm text-teal-100">Total Spent</p>
                        <p className="text-3xl font-bold">{formatCurrency(totalExpenses, currency)}</p>
                    </div>
                </div>
            </div>

            {expenses.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 p-12 text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                        <PieChart className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        No expenses yet
                    </h3>
                    <p className="mt-2 text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                        Start adding expenses to see detailed analytics and insights about your group spending.
                    </p>
                    <Link href={`/groups/${encryptUrlId(id)}/expenses/new`} className="mt-6 inline-block">
                        <Button size="lg">Add First Expense</Button>
                    </Link>
                </div>
            ) : (
                <>
                    {/* Stats Grid - Bento Box Style */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Stat Card 1 - Total Expenses */}
                        <div className="group relative overflow-hidden rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-5 transition-all hover:shadow-lg hover:shadow-teal-500/10 hover:border-teal-200 dark:hover:border-teal-800">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Expenses</p>
                                    <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{expenses.length}</p>
                                </div>
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-900/30 group-hover:scale-110 transition-transform">
                                    <Receipt className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                                </div>
                            </div>
                            <div className="mt-3 flex items-center gap-1 text-xs text-gray-500">
                                <span>{categories.size} categories</span>
                            </div>
                        </div>

                        {/* Stat Card 2 - Average */}
                        <div className="group relative overflow-hidden rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-5 transition-all hover:shadow-lg hover:shadow-blue-500/10 hover:border-blue-200 dark:hover:border-blue-800">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Average</p>
                                    <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                                        {formatCurrency(avgExpense, currency)}
                                    </p>
                                </div>
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30 group-hover:scale-110 transition-transform">
                                    <Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                </div>
                            </div>
                            <div className="mt-3 flex items-center gap-1 text-xs text-gray-500">
                                <span>per expense</span>
                            </div>
                        </div>

                        {/* Stat Card 3 - This Month */}
                        <div className="group relative overflow-hidden rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-5 transition-all hover:shadow-lg hover:shadow-purple-500/10 hover:border-purple-200 dark:hover:border-purple-800">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">This Month</p>
                                    <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                                        {formatCurrency(thisMonthTotal, currency)}
                                    </p>
                                </div>
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30 group-hover:scale-110 transition-transform">
                                    <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                </div>
                            </div>
                            <div className="mt-3 flex items-center gap-1 text-xs">
                                {monthlyChange !== 0 && (
                                    <>
                                        {monthlyChange > 0 ? (
                                            <TrendingUp className="h-3 w-3 text-red-500" />
                                        ) : (
                                            <TrendingDown className="h-3 w-3 text-green-500" />
                                        )}
                                        <span className={monthlyChange > 0 ? "text-red-500" : "text-green-500"}>
                                            {Math.abs(monthlyChange).toFixed(0)}%
                                        </span>
                                        <span className="text-gray-400">vs last month</span>
                                    </>
                                )}
                                {monthlyChange === 0 && (
                                    <span className="text-gray-400">{thisMonthExpenses.length} expenses</span>
                                )}
                            </div>
                        </div>

                        {/* Stat Card 4 - Top Spender */}
                        <div className="group relative overflow-hidden rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-5 transition-all hover:shadow-lg hover:shadow-orange-500/10 hover:border-orange-200 dark:hover:border-orange-800">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Top Spender</p>
                                    <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white truncate">
                                        {topSpender?.name.split(" ")[0] || "N/A"}
                                    </p>
                                </div>
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-900/30 group-hover:scale-110 transition-transform">
                                    <Users className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                                </div>
                            </div>
                            <div className="mt-3 flex items-center gap-1 text-xs text-gray-500">
                                {topSpender && (
                                    <span>{formatCurrency(topSpender.amount, currency)} paid</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Main Charts Grid - Bento Box Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Category Breakdown - Large Card */}
                        <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Spending by Category</h2>
                                    <p className="text-sm text-gray-500">Where your money goes</p>
                                </div>
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-pink-500">
                                    <PieChart className="h-5 w-5 text-white" />
                                </div>
                            </div>
                            <CategoryChart expenses={expenses} currency={currency} />
                        </div>

                        {/* Daily Breakdown */}
                        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Weekly Pattern</h2>
                                    <p className="text-sm text-gray-500">Spending by day</p>
                                </div>
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-400 to-indigo-500">
                                    <Calendar className="h-5 w-5 text-white" />
                                </div>
                            </div>
                            <DailyBreakdownChart expenses={expenses} currency={currency} />
                        </div>

                        {/* Spending Trend */}
                        <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Spending Trend</h2>
                                    <p className="text-sm text-gray-500">Daily spending over time</p>
                                </div>
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-400 to-cyan-500">
                                    <TrendingUp className="h-5 w-5 text-white" />
                                </div>
                            </div>
                            <TrendChart expenses={expenses} currency={currency} />
                        </div>

                        {/* Top Expenses */}
                        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Biggest Expenses</h2>
                                    <p className="text-sm text-gray-500">Top 5 by amount</p>
                                </div>
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-400 to-red-500">
                                    <Wallet className="h-5 w-5 text-white" />
                                </div>
                            </div>
                            <TopExpensesList expenses={expenses} currency={currency} limit={5} />
                        </div>

                        {/* Who Paid What */}
                        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Contributions</h2>
                                    <p className="text-sm text-gray-500">Who paid how much</p>
                                </div>
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-green-500">
                                    <Users className="h-5 w-5 text-white" />
                                </div>
                            </div>
                            <ContributionsChart expenses={expenses} currency={currency} />
                        </div>

                        {/* Member Comparison */}
                        <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Paid vs Share</h2>
                                    <p className="text-sm text-gray-500">What each member paid vs their share</p>
                                </div>
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500">
                                    <Activity className="h-5 w-5 text-white" />
                                </div>
                            </div>
                            <SpendByMemberChart expenses={expenses} currency={currency} currentUserId={user.id} />
                        </div>

                        {/* Member Balances - Full Width */}
                        <div className="lg:col-span-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Current Balances</h2>
                                    <p className="text-sm text-gray-500">Who gets back money vs who owes</p>
                                </div>
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-green-400 to-emerald-500">
                                    <BarChart3 className="h-5 w-5 text-white" />
                                </div>
                            </div>
                            <BalancesChart balances={balances} currency={currency} currentUserId={user.id} />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
