"use client";

import { useMemo, useState } from "react";
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, LineChart, Line, Area, AreaChart,
    Legend, ReferenceLine
} from "recharts";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currency";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

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

const CATEGORY_COLORS: Record<string, string> = {
    food: "#f97316",
    transport: "#3b82f6",
    entertainment: "#a855f7",
    utilities: "#6b7280",
    rent: "#84cc16",
    shopping: "#ec4899",
    travel: "#14b8a6",
    healthcare: "#ef4444",
    groceries: "#22c55e",
    other: "#64748b",
};

const CATEGORY_LABELS: Record<string, string> = {
    food: "Food & Dining",
    transport: "Transport",
    entertainment: "Entertainment",
    utilities: "Utilities",
    rent: "Rent",
    shopping: "Shopping",
    travel: "Travel",
    healthcare: "Healthcare",
    groceries: "Groceries",
    other: "Other",
};

const CATEGORY_EMOJIS: Record<string, string> = {
    food: "🍔",
    transport: "🚗",
    entertainment: "🎬",
    utilities: "💡",
    rent: "🏠",
    shopping: "🛍️",
    travel: "✈️",
    healthcare: "🏥",
    groceries: "🛒",
    other: "📦",
};

const CHART_COLORS = [
    "#14b8a6", "#f97316", "#3b82f6", "#a855f7", "#ef4444",
    "#22c55e", "#ec4899", "#6366f1", "#eab308", "#06b6d4"
];

// Modern gradient definitions for charts
const GRADIENTS = {
    teal: { start: "#14b8a6", end: "#0d9488" },
    blue: { start: "#3b82f6", end: "#2563eb" },
    purple: { start: "#a855f7", end: "#9333ea" },
    orange: { start: "#f97316", end: "#ea580c" },
    pink: { start: "#ec4899", end: "#db2777" },
};

// ==================== CATEGORY CHART (Modern Donut) ====================
interface CategoryChartProps {
    expenses: Expense[];
    currency: string;
}

export function CategoryChart({ expenses, currency }: CategoryChartProps) {
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    const { categoryData, total } = useMemo(() => {
        const categoryMap = new Map<string, number>();
        let totalAmount = 0;
        expenses.forEach((expense) => {
            const category = expense.category || "other";
            categoryMap.set(category, (categoryMap.get(category) || 0) + expense.amount);
            totalAmount += expense.amount;
        });
        const data = Array.from(categoryMap.entries())
            .map(([name, value]) => ({
                name,
                label: CATEGORY_LABELS[name] || name,
                emoji: CATEGORY_EMOJIS[name] || "📦",
                value,
                percentage: totalAmount > 0 ? (value / totalAmount) * 100 : 0,
                color: CATEGORY_COLORS[name] || "#64748b",
            }))
            .sort((a, b) => b.value - a.value);
        return { categoryData: data, total: totalAmount };
    }, [expenses]);

    if (categoryData.length === 0) {
        return (
            <div className="flex h-[320px] items-center justify-center">
                <p className="text-gray-400">No expense data available</p>
            </div>
        );
    }

    const activeData = activeIndex !== null ? categoryData[activeIndex] : null;

    return (
        <div className="flex h-[320px] items-center gap-6">
            {/* Donut Chart with Center Label */}
            <div className="relative h-full w-[200px] flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <defs>
                            {categoryData.map((entry, idx) => (
                                <linearGradient key={`gradient-${idx}`} id={`categoryGradient-${idx}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                                    <stop offset="100%" stopColor={entry.color} stopOpacity={0.7} />
                                </linearGradient>
                            ))}
                        </defs>
                        <Pie
                            data={categoryData}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={activeIndex !== null ? 95 : 90}
                            paddingAngle={3}
                            dataKey="value"
                            onMouseEnter={(_, idx) => setActiveIndex(idx)}
                            onMouseLeave={() => setActiveIndex(null)}
                            animationBegin={0}
                            animationDuration={800}
                        >
                            {categoryData.map((entry, idx) => (
                                <Cell
                                    key={`cell-${idx}`}
                                    fill={`url(#categoryGradient-${idx})`}
                                    stroke={activeIndex === idx ? entry.color : "transparent"}
                                    strokeWidth={activeIndex === idx ? 3 : 0}
                                    style={{
                                        filter: activeIndex === idx ? `drop-shadow(0 0 8px ${entry.color}50)` : "none",
                                        cursor: "pointer",
                                        transition: "all 0.2s ease",
                                    }}
                                />
                            ))}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
                {/* Center content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    {activeData ? (
                        <>
                            <span className="text-2xl">{activeData.emoji}</span>
                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                                {activeData.percentage.toFixed(0)}%
                            </span>
                        </>
                    ) : (
                        <>
                            <span className="text-xs text-gray-500 dark:text-gray-400">Total</span>
                            <span className="text-lg font-bold text-gray-900 dark:text-white">
                                {formatCurrency(total, currency)}
                            </span>
                        </>
                    )}
                </div>
            </div>

            {/* Legend with percentages */}
            <div className="flex-1 space-y-2 overflow-auto max-h-full pr-2">
                {categoryData.map((item, idx) => (
                    <div
                        key={idx}
                        className={cn(
                            "flex items-center gap-3 rounded-lg p-2 transition-all cursor-pointer",
                            activeIndex === idx
                                ? "bg-gray-100 dark:bg-gray-800"
                                : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        )}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onMouseLeave={() => setActiveIndex(null)}
                    >
                        <div
                            className="h-3 w-3 flex-shrink-0 rounded-full"
                            style={{ backgroundColor: item.color }}
                        />
                        <span className="text-xl">{item.emoji}</span>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {item.label}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {formatCurrency(item.value, currency)}
                            </p>
                        </div>
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                            {item.percentage.toFixed(1)}%
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ==================== TREND CHART (Modern Area with Gradient) ====================
interface TrendChartProps {
    expenses: Expense[];
    currency: string;
}

export function TrendChart({ expenses, currency }: TrendChartProps) {
    const { trendData, trend } = useMemo(() => {
        const dayMap = new Map<string, number>();
        expenses.forEach((expense) => {
            const dateStr = expense.expense_date || new Date().toISOString();
            const date = new Date(dateStr);
            const dayKey = date.toISOString().split("T")[0];
            dayMap.set(dayKey, (dayMap.get(dayKey) || 0) + expense.amount);
        });

        const sortedData = Array.from(dayMap.entries())
            .map(([date, amount]) => {
                const d = new Date(date);
                return {
                    date,
                    dateLabel: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                    amount,
                };
            })
            .sort((a, b) => a.date.localeCompare(b.date));

        // Calculate trend (compare average of last half vs first half)
        // Using averages instead of sums to handle odd number of data points fairly
        let trendValue = 0;
        if (sortedData.length >= 2) {
            const midpoint = Math.floor(sortedData.length / 2);
            const firstHalfData = sortedData.slice(0, midpoint);
            const secondHalfData = sortedData.slice(midpoint);
            
            const firstHalfAvg = firstHalfData.length > 0 
                ? firstHalfData.reduce((sum, d) => sum + d.amount, 0) / firstHalfData.length 
                : 0;
            const secondHalfAvg = secondHalfData.length > 0 
                ? secondHalfData.reduce((sum, d) => sum + d.amount, 0) / secondHalfData.length 
                : 0;
            
            if (firstHalfAvg > 0) {
                trendValue = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
            }
        }

        return { trendData: sortedData, trend: trendValue };
    }, [expenses]);

    if (trendData.length === 0) {
        return (
            <div className="flex h-[280px] items-center justify-center">
                <p className="text-gray-400">No expense data available</p>
            </div>
        );
    }

    const TrendIcon = trend > 5 ? TrendingUp : trend < -5 ? TrendingDown : Minus;
    const trendColor = trend > 5 ? "text-red-500" : trend < -5 ? "text-green-500" : "text-gray-500";

    return (
        <div className="space-y-4">
            {/* Trend indicator */}
            <div className="flex items-center gap-2">
                <TrendIcon className={cn("h-4 w-4", trendColor)} />
                <span className={cn("text-sm font-medium", trendColor)}>
                    {Math.abs(trend).toFixed(0)}% {trend > 5 ? "increase" : trend < -5 ? "decrease" : "stable"}
                </span>
                <span className="text-xs text-gray-500">vs previous period</span>
            </div>

            <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData}>
                        <defs>
                            <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200/50 dark:stroke-gray-700/50" vertical={false} />
                        <XAxis
                            dataKey="dateLabel"
                            tick={{ fontSize: 10, fill: "#9ca3af" }}
                            axisLine={false}
                            tickLine={false}
                            interval="preserveStartEnd"
                        />
                        <YAxis
                            tick={{ fontSize: 10, fill: "#9ca3af" }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(value) => formatCurrency(value, currency).replace(/\.00$/, "")}
                            width={60}
                        />
                        <Tooltip
                            content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                    return (
                                        <div className="rounded-xl border border-gray-200 bg-white/95 p-3 shadow-xl backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/95">
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                                            <p className="text-lg font-bold text-gray-900 dark:text-white">
                                                {formatCurrency(payload[0].value as number, currency)}
                                            </p>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Area
                            type="monotone"
                            dataKey="amount"
                            stroke="#3b82f6"
                            strokeWidth={2.5}
                            fill="url(#trendGradient)"
                            dot={false}
                            activeDot={{
                                r: 6,
                                fill: "#3b82f6",
                                stroke: "#fff",
                                strokeWidth: 2,
                            }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

// ==================== CONTRIBUTIONS CHART (Modern Horizontal Bar) ====================
interface ContributionsChartProps {
    expenses: Expense[];
    currency: string;
}

export function ContributionsChart({ expenses, currency }: ContributionsChartProps) {
    const { contributionData, maxAmount } = useMemo(() => {
        const paidMap = new Map<string, { name: string; amount: number }>();

        expenses.forEach((expense) => {
            const payerId = expense.paid_by || expense.paid_by_placeholder?.id || "unknown";
            const payerName = expense.paid_by_profile?.full_name
                || expense.paid_by_placeholder?.name
                || "Unknown";

            if (!paidMap.has(payerId)) {
                paidMap.set(payerId, { name: payerName, amount: 0 });
            }
            const current = paidMap.get(payerId)!;
            current.amount += expense.amount;
        });

        const data = Array.from(paidMap.values())
            .map((item, idx) => ({
                ...item,
                displayName: item.name === "Unknown" ? "Unknown" : item.name.split(" ")[0],
                color: CHART_COLORS[idx % CHART_COLORS.length],
            }))
            .sort((a, b) => b.amount - a.amount);

        return {
            contributionData: data,
            maxAmount: data.length > 0 ? data[0].amount : 0
        };
    }, [expenses]);

    if (contributionData.length === 0) {
        return (
            <div className="flex h-[280px] items-center justify-center">
                <p className="text-gray-400">No contribution data available</p>
            </div>
        );
    }

    const totalContributions = contributionData.reduce((sum, c) => sum + c.amount, 0);

    return (
        <div className="space-y-4">
            {contributionData.map((contributor, idx) => {
                const percentage = totalContributions > 0
                    ? (contributor.amount / totalContributions) * 100
                    : 0;
                const barWidth = maxAmount > 0 ? (contributor.amount / maxAmount) * 100 : 0;

                return (
                    <div key={idx} className="group">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <div
                                    className="h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md"
                                    style={{ backgroundColor: contributor.color }}
                                >
                                    {contributor.displayName[0]?.toUpperCase()}
                                </div>
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    {contributor.displayName}
                                </span>
                            </div>
                            <div className="text-right">
                                <span className="text-sm font-bold text-gray-900 dark:text-white">
                                    {formatCurrency(contributor.amount, currency)}
                                </span>
                                <span className="ml-2 text-xs text-gray-500">
                                    ({percentage.toFixed(0)}%)
                                </span>
                            </div>
                        </div>
                        <div className="relative h-3 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                            <div
                                className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
                                style={{
                                    width: `${barWidth}%`,
                                    background: `linear-gradient(90deg, ${contributor.color}dd, ${contributor.color})`,
                                    boxShadow: `0 0 10px ${contributor.color}40`,
                                }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ==================== SPEND BY MEMBER CHART (Modern Comparison) ====================
interface SpendByMemberChartProps {
    expenses: Expense[];
    currency: string;
    currentUserId: string;
}

export function SpendByMemberChart({ expenses, currency, currentUserId }: SpendByMemberChartProps) {
    const memberData = useMemo(() => {
        const memberMap = new Map<string, { name: string; paid: number; owes: number }>();

        expenses.forEach((expense) => {
            // Track who paid
            const payerId = expense.paid_by || expense.paid_by_placeholder?.id || "unknown";
            const payerName = expense.paid_by_profile?.full_name
                || expense.paid_by_placeholder?.name
                || "Unknown";

            if (!memberMap.has(payerId)) {
                memberMap.set(payerId, { name: payerName, paid: 0, owes: 0 });
            }
            memberMap.get(payerId)!.paid += expense.amount;

            // Track who owes
            if (expense.splits && expense.splits.length > 0) {
                expense.splits.forEach((split) => {
                    const memberId = split.user_id || split.placeholder_id || "unknown";
                    const memberName = split.profile?.full_name
                        || split.placeholder?.name
                        || "Unknown";

                    if (!memberMap.has(memberId)) {
                        memberMap.set(memberId, { name: memberName, paid: 0, owes: 0 });
                    }
                    memberMap.get(memberId)!.owes += split.amount;
                });
            }
        });

        return Array.from(memberMap.entries())
            .map(([id, data], idx) => ({
                id,
                name: id === currentUserId ? "You" : (data.name === "Unknown" ? "Unknown" : data.name.split(" ")[0]),
                paid: data.paid,
                owes: data.owes,
                color: CHART_COLORS[idx % CHART_COLORS.length],
            }))
            .sort((a, b) => b.paid - a.paid);
    }, [expenses, currentUserId]);

    if (memberData.length === 0) {
        return (
            <div className="flex h-[280px] items-center justify-center">
                <p className="text-gray-400">No member data available</p>
            </div>
        );
    }

    return (
        <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={memberData}
                    layout="vertical"
                    barGap={2}
                    barSize={14}
                >
                    <defs>
                        <linearGradient id="paidGradient" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.8} />
                            <stop offset="100%" stopColor="#22c55e" stopOpacity={1} />
                        </linearGradient>
                        <linearGradient id="owesGradient" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#f97316" stopOpacity={0.8} />
                            <stop offset="100%" stopColor="#f97316" stopOpacity={1} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200/50 dark:stroke-gray-700/50" horizontal={false} />
                    <XAxis
                        type="number"
                        tick={{ fontSize: 10, fill: "#9ca3af" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => formatCurrency(value, currency).replace(/\.00$/, "")}
                    />
                    <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 11, fill: "#6b7280", fontWeight: 500 }}
                        axisLine={false}
                        tickLine={false}
                        width={60}
                    />
                    <Tooltip
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                    <div className="rounded-xl border border-gray-200 bg-white/95 p-3 shadow-xl backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/95">
                                        <p className="font-medium text-gray-900 dark:text-white mb-2">{data.name}</p>
                                        <div className="space-y-1 text-sm">
                                            <p className="text-green-600">
                                                Paid: {formatCurrency(data.paid, currency)}
                                            </p>
                                            <p className="text-orange-600">
                                                Share: {formatCurrency(data.owes, currency)}
                                            </p>
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Legend
                        verticalAlign="top"
                        height={36}
                        formatter={(value) => (
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                                {value === "paid" ? "💰 Paid" : "📊 Share"}
                            </span>
                        )}
                    />
                    <Bar dataKey="paid" name="paid" fill="url(#paidGradient)" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="owes" name="owes" fill="url(#owesGradient)" radius={[0, 4, 4, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

// ==================== BALANCES CHART (Modern Column Chart) ====================
interface BalancesChartProps {
    balances: Balance[];
    currency: string;
    currentUserId: string;
}

export function BalancesChart({ balances, currency, currentUserId }: BalancesChartProps) {
    const balanceData = useMemo(() => {
        return balances
            .map((b, idx) => ({
                name: b.user_id === currentUserId ? "You" : (b.user_name || "Unknown").split(" ")[0],
                balance: b.balance,
                isPositive: b.balance >= 0,
                color: b.balance >= 0 ? "#22c55e" : "#ef4444",
            }))
            .sort((a, b) => b.balance - a.balance);
    }, [balances, currentUserId]);

    if (balanceData.length === 0) {
        return (
            <div className="flex h-[280px] items-center justify-center">
                <p className="text-gray-400">No balance data available</p>
            </div>
        );
    }

    const maxAbsBalance = Math.max(...balanceData.map(d => Math.abs(d.balance)));

    return (
        <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={balanceData} barSize={40}>
                    <defs>
                        <linearGradient id="positiveGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22c55e" stopOpacity={1} />
                            <stop offset="100%" stopColor="#22c55e" stopOpacity={0.6} />
                        </linearGradient>
                        <linearGradient id="negativeGradient" x1="0" y1="1" x2="0" y2="0">
                            <stop offset="0%" stopColor="#ef4444" stopOpacity={1} />
                            <stop offset="100%" stopColor="#ef4444" stopOpacity={0.6} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200/50 dark:stroke-gray-700/50" vertical={false} />
                    <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: "#6b7280", fontWeight: 500 }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis
                        tick={{ fontSize: 10, fill: "#9ca3af" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => {
                            const sign = value >= 0 ? "+" : "";
                            return `${sign}${formatCurrency(Math.abs(value), currency).replace(/\.00$/, "")}`;
                        }}
                        domain={[-maxAbsBalance * 1.1, maxAbsBalance * 1.1]}
                    />
                    <Tooltip
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const value = payload[0].value as number;
                                const isPositive = value >= 0;
                                return (
                                    <div className="rounded-xl border border-gray-200 bg-white/95 p-3 shadow-xl backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/95">
                                        <p className={cn(
                                            "text-lg font-bold",
                                            isPositive ? "text-green-600" : "text-red-600"
                                        )}>
                                            {isPositive ? "+" : ""}{formatCurrency(value, currency)}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {isPositive ? "Gets back from others" : "Owes to others"}
                                        </p>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
                    <Bar
                        dataKey="balance"
                        radius={[6, 6, 6, 6]}
                        fill="#22c55e"
                    >
                        {balanceData.map((entry, idx) => (
                            <Cell
                                key={`cell-${idx}`}
                                fill={entry.isPositive ? "url(#positiveGradient)" : "url(#negativeGradient)"}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

// ==================== DAILY BREAKDOWN CHART (New) ====================
interface DailyBreakdownChartProps {
    expenses: Expense[];
    currency: string;
}

export function DailyBreakdownChart({ expenses, currency }: DailyBreakdownChartProps) {
    const dailyData = useMemo(() => {
        const dayTotals: Record<string, number> = {
            Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0
        };
        const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

        expenses.forEach((expense) => {
            const dateStr = expense.expense_date || new Date().toISOString();
            const date = new Date(dateStr);
            const dayName = dayNames[date.getDay()];
            dayTotals[dayName] += expense.amount;
        });

        const orderedDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        return orderedDays.map(day => ({
            day,
            amount: dayTotals[day],
        }));
    }, [expenses]);

    const maxAmount = Math.max(...dailyData.map(d => d.amount));

    return (
        <div className="space-y-3">
            {dailyData.map((day, idx) => {
                const percentage = maxAmount > 0 ? (day.amount / maxAmount) * 100 : 0;
                const isWeekend = day.day === "Sat" || day.day === "Sun";

                return (
                    <div key={idx} className="flex items-center gap-3">
                        <span className={cn(
                            "w-8 text-xs font-medium",
                            isWeekend ? "text-purple-600 dark:text-purple-400" : "text-gray-600 dark:text-gray-400"
                        )}>
                            {day.day}
                        </span>
                        <div className="flex-1 relative h-6 rounded-md bg-gray-100 dark:bg-gray-800 overflow-hidden">
                            <div
                                className={cn(
                                    "absolute inset-y-0 left-0 rounded-md transition-all duration-500",
                                    isWeekend
                                        ? "bg-gradient-to-r from-purple-500 to-purple-400"
                                        : "bg-gradient-to-r from-teal-500 to-teal-400"
                                )}
                                style={{ width: `${percentage}%` }}
                            />
                            {day.amount > 0 && (
                                <span className="absolute inset-0 flex items-center justify-end pr-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                                    {formatCurrency(day.amount, currency)}
                                </span>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ==================== TOP EXPENSES LIST (New) ====================
interface TopExpensesListProps {
    expenses: Expense[];
    currency: string;
    limit?: number;
}

export function TopExpensesList({ expenses, currency, limit = 5 }: TopExpensesListProps) {
    const topExpenses = useMemo(() => {
        return [...expenses]
            .sort((a, b) => b.amount - a.amount)
            .slice(0, limit);
    }, [expenses, limit]);

    if (topExpenses.length === 0) {
        return (
            <div className="flex h-[200px] items-center justify-center">
                <p className="text-gray-400">No expenses yet</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {topExpenses.map((expense, idx) => {
                const category = expense.category || "other";
                const paidBy = expense.paid_by_profile?.full_name
                    || expense.paid_by_placeholder?.name
                    || "Unknown";

                return (
                    <div
                        key={expense.id}
                        className="flex items-center gap-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3"
                    >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl text-xl bg-white dark:bg-gray-800 shadow-sm">
                            {CATEGORY_EMOJIS[category]}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {expense.description}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Paid by {paidBy.split(" ")[0]}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm font-bold text-gray-900 dark:text-white">
                                {formatCurrency(expense.amount, currency)}
                            </p>
                            <p className="text-xs text-gray-400">
                                #{idx + 1}
                            </p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
