"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
    TrendingUp, TrendingDown, Crown, Flame, Zap, Calendar,
    Sparkles, ArrowUpRight, ChevronRight, Star, PieChart,
    BarChart3, Users, Wallet, Receipt, Target, Clock, ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import {
    CategoryChart,
    TrendChart,
    ContributionsChart,
    BalancesChart,
    SpendByMemberChart,
    TopExpensesList,
} from "@/components/features/groups/analytics-charts";

interface Split {
    id: string;
    user_id: string | null;
    placeholder_id?: string | null;
    amount: number;
    profile?: { id: string; full_name: string | null } | null;
    placeholder?: { id: string; name: string } | null;
}

interface Expense {
    id: string;
    description: string;
    amount: number;
    category: string | null;
    expense_date: string | null;
    paid_by: string | null;
    paid_by_profile?: {
        id: string;
        full_name: string | null;
        avatar_url: string | null;
    } | null;
    paid_by_placeholder?: {
        id: string;
        name: string;
    } | null;
    splits?: Split[];
}

interface Balance {
    user_id: string;
    user_name: string;
    balance: number;
    is_placeholder?: boolean;
}

interface Member {
    id: string;
    user_id: string | null;
    role: string | null;
    is_placeholder?: boolean;
    profile: {
        id: string;
        email: string;
        full_name: string | null;
        avatar_url: string | null;
    } | null;
    placeholder: {
        id: string;
        name: string;
    } | null;
}

interface Group {
    id: string;
    name: string;
    members: Member[];
    currency?: string | null;
}

interface AnalyticsClientProps {
    group: Group;
    expenses: Expense[];
    balances: Balance[];
    currency: string;
    currentUserId: string;
    encryptedGroupId: string;
}

const CATEGORY_EMOJIS: Record<string, string> = {
    food: "🍔", transport: "🚗", entertainment: "🎬", utilities: "💡",
    rent: "🏠", shopping: "🛍️", travel: "✈️", healthcare: "🏥",
    groceries: "🛒", other: "📦",
};

const CATEGORY_COLORS: Record<string, string> = {
    food: "from-orange-500 to-amber-500",
    transport: "from-blue-500 to-cyan-500",
    entertainment: "from-purple-500 to-pink-500",
    utilities: "from-gray-500 to-slate-500",
    rent: "from-lime-500 to-green-500",
    shopping: "from-pink-500 to-rose-500",
    travel: "from-teal-500 to-emerald-500",
    healthcare: "from-red-500 to-orange-500",
    groceries: "from-green-500 to-teal-500",
    other: "from-slate-500 to-gray-500",
};

type TimeFilter = "all" | "month" | "week";

export function AnalyticsClient({
    group,
    expenses,
    balances,
    currency,
    currentUserId,
    encryptedGroupId,
}: AnalyticsClientProps) {
    const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
    const [activeSection, setActiveSection] = useState<string | null>(null);

    // Filter expenses based on time period
    const filteredExpenses = useMemo(() => {
        const safeExpenses = expenses || [];
        if (timeFilter === "all") return safeExpenses;

        const now = new Date();
        const cutoff = new Date();

        if (timeFilter === "week") {
            cutoff.setDate(now.getDate() - 7);
        } else if (timeFilter === "month") {
            cutoff.setMonth(now.getMonth() - 1);
        }

        return safeExpenses.filter(e => {
            const expenseDate = new Date(e.expense_date || "");
            return expenseDate >= cutoff;
        });
    }, [expenses, timeFilter]);

    // Calculate all insights
    const insights = useMemo(() => {
        const total = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
        const avg = filteredExpenses.length > 0 ? total / filteredExpenses.length : 0;
        const categories = new Map<string, number>();
        const spenders = new Map<string, { name: string; amount: number; avatar?: string | null }>();
        const dailySpending = new Map<string, number>();
        const weekdaySpending: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

        filteredExpenses.forEach((expense) => {
            // Categories
            const cat = expense.category || "other";
            categories.set(cat, (categories.get(cat) || 0) + expense.amount);

            // Spenders
            const payerId = expense.paid_by || expense.paid_by_placeholder?.id || "unknown";
            const payerName = expense.paid_by_profile?.full_name || expense.paid_by_placeholder?.name || "Unknown";
            const payerAvatar = expense.paid_by_profile?.avatar_url;
            if (!spenders.has(payerId)) {
                spenders.set(payerId, { name: payerName, amount: 0, avatar: payerAvatar });
            }
            spenders.get(payerId)!.amount += expense.amount;

            // Daily spending
            const dateStr = expense.expense_date?.split("T")[0] || new Date().toISOString().split("T")[0];
            dailySpending.set(dateStr, (dailySpending.get(dateStr) || 0) + expense.amount);

            // Weekday spending
            const date = new Date(expense.expense_date || "");
            weekdaySpending[date.getDay()] += expense.amount;
        });

        // Top category
        const sortedCategories = Array.from(categories.entries()).sort((a, b) => b[1] - a[1]);
        const topCategory = sortedCategories[0];

        // Top spender
        const sortedSpenders = Array.from(spenders.entries())
            .map(([id, data]) => ({ id, ...data }))
            .sort((a, b) => b.amount - a.amount);
        const topSpender = sortedSpenders[0];

        // Biggest expense
        const biggestExpense = filteredExpenses.length > 0
            ? filteredExpenses.reduce((max, e) => e.amount > max.amount ? e : max, filteredExpenses[0])
            : null;

        // Busiest day
        const busiestDay = Object.entries(weekdaySpending)
            .map(([day, amount]) => ({ day: parseInt(day), amount }))
            .sort((a, b) => b.amount - a.amount)[0];
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

        // Spending streak
        const sortedDates = Array.from(dailySpending.keys()).sort();
        let streak = 0;
        if (sortedDates.length > 0) {
            const today = new Date().toISOString().split("T")[0];
            let checkDate = today;
            while (dailySpending.has(checkDate)) {
                streak++;
                const d = new Date(checkDate);
                d.setDate(d.getDate() - 1);
                checkDate = d.toISOString().split("T")[0];
            }
        }

        // Month over month comparison
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
            : thisMonthTotal > 0 ? 100 : 0;

        return {
            total,
            avg,
            count: filteredExpenses.length,
            categoryCount: categories.size,
            topCategory,
            topSpender,
            biggestExpense,
            busiestDay: busiestDay ? dayNames[busiestDay.day] : null,
            streak,
            thisMonthTotal,
            lastMonthTotal,
            monthlyChange,
            sortedCategories,
            sortedSpenders,
        };
    }, [filteredExpenses, expenses]);

    if (!expenses || expenses.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-full blur-2xl opacity-20 animate-pulse" />
                    <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                        <PieChart className="h-12 w-12 text-white" />
                    </div>
                </div>
                <h2 className="mt-8 text-2xl font-bold text-gray-900 dark:text-white">No Data Yet</h2>
                <p className="mt-2 text-gray-500 dark:text-gray-400 text-center max-w-md">
                    Start tracking expenses to unlock powerful insights about your group&apos;s spending patterns.
                </p>
                <Link href={`/groups/${encryptedGroupId}/expenses/new`} className="mt-8">
                    <Button size="lg" className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">
                        <Sparkles className="mr-2 h-5 w-5" />
                        Add First Expense
                    </Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Hero Section with Key Stats */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-8 text-white">
                {/* Animated background shapes */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-white/10 to-transparent rounded-full blur-3xl" />
                    <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-black/20 to-transparent rounded-full blur-3xl" />
                </div>

                <div className="relative">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-8">
                        <div>
                            <div className="flex items-center gap-2 text-violet-200 mb-2">
                                <Sparkles className="h-4 w-4" />
                                <span className="text-sm font-medium">Expense Analytics</span>
                            </div>
                            <h1 className="text-4xl font-bold tracking-tight">{group.name}</h1>
                        </div>

                        {/* Time Filter Pills */}
                        <div className="flex gap-1 bg-white/10 backdrop-blur-sm rounded-full p-1">
                            {(["week", "month", "all"] as TimeFilter[]).map((filter) => (
                                <button
                                    key={filter}
                                    onClick={() => setTimeFilter(filter)}
                                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                                        timeFilter === filter
                                            ? "bg-white text-violet-700 shadow-lg"
                                            : "text-white/70 hover:text-white hover:bg-white/10"
                                    }`}
                                >
                                    {filter === "all" ? "All Time" : filter === "month" ? "30 Days" : "7 Days"}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Big Number */}
                    <div className="mb-8">
                        <p className="text-violet-200 text-sm mb-1">Total Spent</p>
                        <div className="flex items-baseline gap-3">
                            <span className="text-6xl font-bold tracking-tight">
                                {formatCurrency(insights.total, currency)}
                            </span>
                            {insights.monthlyChange !== 0 && timeFilter === "all" && (
                                <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                                    insights.monthlyChange > 0 
                                        ? "bg-rose-500/20 text-rose-200" 
                                        : "bg-emerald-500/20 text-emerald-200"
                                }`}>
                                    {insights.monthlyChange > 0 ? (
                                        <TrendingUp className="h-4 w-4" />
                                    ) : (
                                        <TrendingDown className="h-4 w-4" />
                                    )}
                                    {Math.abs(insights.monthlyChange).toFixed(0)}% vs last month
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
                            <Receipt className="h-5 w-5 text-violet-200 mb-2" />
                            <p className="text-2xl font-bold">{insights.count}</p>
                            <p className="text-violet-200 text-sm">Expenses</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
                            <Target className="h-5 w-5 text-violet-200 mb-2" />
                            <p className="text-2xl font-bold">{formatCurrency(insights.avg, currency)}</p>
                            <p className="text-violet-200 text-sm">Average</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
                            <Users className="h-5 w-5 text-violet-200 mb-2" />
                            <p className="text-2xl font-bold">{(group.members || []).length}</p>
                            <p className="text-violet-200 text-sm">Members</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
                            <Calendar className="h-5 w-5 text-violet-200 mb-2" />
                            <p className="text-2xl font-bold">{insights.categoryCount}</p>
                            <p className="text-violet-200 text-sm">Categories</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Insights Cards - Horizontal Scroll on Mobile */}
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-4">
                {/* Top Spender */}
                {insights.topSpender && (
                    <div className="flex-shrink-0 w-[280px] md:w-auto bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-2xl p-5 border border-amber-200/50 dark:border-amber-800/50">
                        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-3">
                            <Crown className="h-5 w-5" />
                            <span className="text-sm font-semibold">Top Spender</span>
                        </div>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">
                            {insights.topSpender.name.split(" ")[0]}
                        </p>
                        <p className="text-amber-600 dark:text-amber-400 font-medium">
                            {formatCurrency(insights.topSpender.amount, currency)}
                        </p>
                    </div>
                )}

                {/* Biggest Expense */}
                {insights.biggestExpense && (
                    <div className="flex-shrink-0 w-[280px] md:w-auto bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30 rounded-2xl p-5 border border-rose-200/50 dark:border-rose-800/50">
                        <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 mb-3">
                            <Flame className="h-5 w-5" />
                            <span className="text-sm font-semibold">Biggest Expense</span>
                        </div>
                        <p className="text-xl font-bold text-gray-900 dark:text-white truncate">
                            {insights.biggestExpense.description}
                        </p>
                        <p className="text-rose-600 dark:text-rose-400 font-medium">
                            {formatCurrency(insights.biggestExpense.amount, currency)}
                        </p>
                    </div>
                )}

                {/* Top Category */}
                {insights.topCategory && (
                    <div className="flex-shrink-0 w-[280px] md:w-auto bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 rounded-2xl p-5 border border-violet-200/50 dark:border-violet-800/50">
                        <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400 mb-3">
                            <Star className="h-5 w-5" />
                            <span className="text-sm font-semibold">Most Spent On</span>
                        </div>
                        <p className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <span>{CATEGORY_EMOJIS[insights.topCategory[0]] || "📦"}</span>
                            <span className="capitalize">{insights.topCategory[0]}</span>
                        </p>
                        <p className="text-violet-600 dark:text-violet-400 font-medium">
                            {formatCurrency(insights.topCategory[1], currency)}
                        </p>
                    </div>
                )}

                {/* Busiest Day */}
                {insights.busiestDay && (
                    <div className="flex-shrink-0 w-[280px] md:w-auto bg-gradient-to-br from-cyan-50 to-teal-50 dark:from-cyan-950/30 dark:to-teal-950/30 rounded-2xl p-5 border border-cyan-200/50 dark:border-cyan-800/50">
                        <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 mb-3">
                            <Zap className="h-5 w-5" />
                            <span className="text-sm font-semibold">Peak Spending Day</span>
                        </div>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">
                            {insights.busiestDay}
                        </p>
                        <p className="text-cyan-600 dark:text-cyan-400 font-medium">
                            Most active day
                        </p>
                    </div>
                )}
            </div>

            {/* Category Breakdown - Visual */}
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Where the Money Goes</h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">Spending breakdown by category</p>
                    </div>
                </div>

                {/* Category Pills */}
                <div className="flex flex-wrap gap-2 mb-6">
                    {insights.sortedCategories.slice(0, 6).map(([category, amount], idx) => {
                        const percentage = insights.total > 0 ? (amount / insights.total) * 100 : 0;
                        return (
                            <div
                                key={category}
                                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${CATEGORY_COLORS[category] || "from-gray-500 to-slate-500"} text-white`}
                            >
                                <span className="text-lg">{CATEGORY_EMOJIS[category] || "📦"}</span>
                                <span className="font-medium capitalize">{category}</span>
                                <span className="text-white/80 text-sm">{percentage.toFixed(0)}%</span>
                            </div>
                        );
                    })}
                </div>

                <CategoryChart expenses={filteredExpenses} currency={currency} />
            </div>

            {/* Two Column Layout */}
            <div className="grid md:grid-cols-2 gap-6">
                {/* Spending Trend */}
                <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Spending Trend</h2>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">How spending changed over time</p>
                        </div>
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                            <TrendingUp className="h-5 w-5 text-white" />
                        </div>
                    </div>
                    <TrendChart expenses={filteredExpenses} currency={currency} />
                </div>

                {/* Top Expenses */}
                <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Top Expenses</h2>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Biggest spending items</p>
                        </div>
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center">
                            <Flame className="h-5 w-5 text-white" />
                        </div>
                    </div>
                    <TopExpensesList expenses={filteredExpenses} currency={currency} limit={5} />
                </div>
            </div>

            {/* Member Section */}
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Who Paid What</h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">Contribution from each member</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                        <Users className="h-5 w-5 text-white" />
                    </div>
                </div>

                {/* Member Cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
                    {insights.sortedSpenders.slice(0, 8).map((spender, idx) => {
                        const percentage = insights.total > 0 ? (spender.amount / insights.total) * 100 : 0;
                        const isTop = idx === 0;

                        return (
                            <div
                                key={spender.id}
                                className={`relative p-4 rounded-2xl border ${
                                    isTop 
                                        ? "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800"
                                        : "bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800"
                                }`}
                            >
                                {isTop && (
                                    <div className="absolute -top-2 -right-2">
                                        <div className="bg-amber-500 rounded-full p-1.5">
                                            <Crown className="h-3 w-3 text-white" />
                                        </div>
                                    </div>
                                )}
                                <div className="flex items-center gap-3 mb-3">
                                    <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-bold ${
                                        isTop ? "bg-gradient-to-br from-amber-500 to-orange-500" : "bg-gradient-to-br from-violet-500 to-purple-500"
                                    }`}>
                                        {spender.name[0]?.toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-semibold text-gray-900 dark:text-white truncate">
                                            {spender.id === currentUserId ? "You" : spender.name.split(" ")[0]}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {percentage.toFixed(0)}% of total
                                        </p>
                                    </div>
                                </div>
                                <p className={`text-lg font-bold ${isTop ? "text-amber-600 dark:text-amber-400" : "text-gray-900 dark:text-white"}`}>
                                    {formatCurrency(spender.amount, currency)}
                                </p>
                            </div>
                        );
                    })}
                </div>

                <ContributionsChart expenses={filteredExpenses} currency={currency} />
            </div>

            {/* Balances */}
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Settlement Status</h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">Who owes whom in the group</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                        <Wallet className="h-5 w-5 text-white" />
                    </div>
                </div>

                {/* Balance Summary Cards */}
                <div className="flex gap-4 overflow-x-auto pb-4 mb-6 -mx-2 px-2">
                    {(balances || [])
                        .sort((a, b) => b.balance - a.balance)
                        .map((balance) => {
                            const isPositive = balance.balance >= 0;
                            const isYou = balance.user_id === currentUserId;

                            return (
                                <div
                                    key={balance.user_id}
                                    className={`flex-shrink-0 w-[200px] p-4 rounded-2xl ${
                                        isPositive
                                            ? "bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border border-green-200 dark:border-green-800"
                                            : "bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20 border border-red-200 dark:border-red-800"
                                    }`}
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                                            isPositive ? "bg-green-500" : "bg-red-500"
                                        }`}>
                                            {balance.user_name[0]?.toUpperCase()}
                                        </div>
                                        <span className="font-medium text-gray-900 dark:text-white">
                                            {isYou ? "You" : balance.user_name.split(" ")[0]}
                                        </span>
                                    </div>
                                    <p className={`text-xl font-bold ${isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                        {isPositive ? "+" : ""}{formatCurrency(balance.balance, currency)}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {isPositive ? "Gets back" : "Owes"}
                                    </p>
                                </div>
                            );
                        })}
                </div>

                <BalancesChart balances={balances} currency={currency} currentUserId={currentUserId} />
            </div>

            {/* Paid vs Share Comparison */}
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Paid vs Share</h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">Comparing what each person paid vs their fair share</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
                        <BarChart3 className="h-5 w-5 text-white" />
                    </div>
                </div>
                <SpendByMemberChart expenses={filteredExpenses} currency={currency} currentUserId={currentUserId} />
            </div>
        </div>
    );
}

