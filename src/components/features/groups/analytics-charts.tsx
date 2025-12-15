"use client";

import { useMemo } from "react";
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, LineChart, Line, RadarChart, Radar,
    PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend
} from "recharts";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currency";

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
    food: "🍔 Food",
    transport: "🚗 Transport",
    entertainment: "🎬 Entertainment",
    utilities: "💡 Utilities",
    rent: "🏠 Rent",
    shopping: "🛍️ Shopping",
    travel: "✈️ Travel",
    healthcare: "🏥 Healthcare",
    groceries: "🛒 Groceries",
    other: "📦 Other",
};

const CHART_COLORS = [
    "#14b8a6", "#f97316", "#3b82f6", "#a855f7", "#ef4444",
    "#22c55e", "#ec4899", "#6366f1", "#eab308", "#06b6d4"
];

// Tooltip Components
interface TooltipPayload {
    value: number;
    name: string;
}

interface CustomTooltipProps {
    active?: boolean;
    payload?: TooltipPayload[];
    label?: string;
    currency: string;
}

function CustomTooltip({ active, payload, label, currency }: CustomTooltipProps) {
    if (active && payload && payload.length) {
        return (
            <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                {label && <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">{label}</p>}
                {payload.map((entry, idx) => (
                    <p key={idx} className="text-sm font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(entry.value, currency)}
                    </p>
                ))}
            </div>
        );
    }
    return null;
}

interface BalanceTooltipProps {
    active?: boolean;
    payload?: Array<{ value: number }>;
    currency: string;
}

function BalanceTooltip({ active, payload, currency }: BalanceTooltipProps) {
    if (active && payload && payload.length) {
        const value = payload[0].value;
        const sign = value >= 0 ? "+" : "";
        return (
            <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <p className={cn(
                    "text-sm font-semibold",
                    value >= 0 ? "text-green-600" : "text-red-600"
                )}>
                    {sign}{formatCurrency(Math.abs(value), currency)}
                </p>
                <p className="text-xs text-gray-500">
                    {value >= 0 ? "Gets back" : "Owes"}
                </p>
            </div>
        );
    }
    return null;
}

// ==================== CATEGORY CHART (Donut) ====================
interface CategoryChartProps {
    expenses: Expense[];
    currency: string;
}

export function CategoryChart({ expenses, currency }: CategoryChartProps) {
    const categoryData = useMemo(() => {
        const categoryMap = new Map<string, number>();
        expenses.forEach((expense) => {
            const category = expense.category || "other";
            categoryMap.set(category, (categoryMap.get(category) || 0) + expense.amount);
        });
        return Array.from(categoryMap.entries())
            .map(([name, value]) => ({
                name: CATEGORY_LABELS[name] || name,
                value,
                color: CATEGORY_COLORS[name] || "#64748b",
            }))
            .sort((a, b) => b.value - a.value);
    }, [expenses]);

    if (categoryData.length === 0) {
        return <div className="h-[300px] flex items-center justify-center text-gray-500">No data</div>;
    }

    return (
        <div className="flex h-[300px] items-center gap-4">
            <div className="h-full flex-1">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={categoryData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={90}
                            paddingAngle={2}
                            dataKey="value"
                        >
                            {categoryData.map((entry, idx) => (
                                <Cell key={`cell-${idx}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip currency={currency} />} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="max-h-full w-40 overflow-auto pr-2">
                <div className="space-y-2">
                    {categoryData.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                                <div
                                    className="h-3 w-3 flex-shrink-0 rounded-full"
                                    style={{ backgroundColor: item.color }}
                                />
                                <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                    {item.name}
                                </span>
                            </div>
                            <span className="text-xs font-medium text-gray-900 dark:text-white flex-shrink-0">
                                {formatCurrency(item.value, currency)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ==================== TREND CHART (Line with dots) ====================
interface TrendChartProps {
    expenses: Expense[];
    currency: string;
}

export function TrendChart({ expenses, currency }: TrendChartProps) {
    const trendData = useMemo(() => {
        const monthMap = new Map<string, number>();
        expenses.forEach((expense) => {
            const dateStr = expense.expense_date || new Date().toISOString();
            const date = new Date(dateStr);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
            monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + expense.amount);
        });
        return Array.from(monthMap.entries())
            .map(([month, amount]) => {
                const [year, monthNum] = month.split("-");
                const date = new Date(parseInt(year), parseInt(monthNum) - 1);
                return {
                    month,
                    monthLabel: date.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
                    amount,
                };
            })
            .sort((a, b) => a.month.localeCompare(b.month));
    }, [expenses]);

    if (trendData.length === 0) {
        return <div className="h-[300px] flex items-center justify-center text-gray-500">No data</div>;
    }

    return (
        <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                    <XAxis
                        dataKey="monthLabel"
                        tick={{ fontSize: 11 }}
                        className="fill-gray-500 dark:fill-gray-400"
                    />
                    <YAxis
                        tick={{ fontSize: 11 }}
                        className="fill-gray-500 dark:fill-gray-400"
                        tickFormatter={(value) => formatCurrency(value, currency).replace(/\.00$/, "")}
                    />
                    <Tooltip content={<CustomTooltip currency={currency} />} />
                    <Line
                        type="monotone"
                        dataKey="amount"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        dot={{ fill: "#3b82f6", strokeWidth: 2, r: 5 }}
                        activeDot={{ r: 7, fill: "#1d4ed8" }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

// ==================== CONTRIBUTIONS CHART (Horizontal Bar) ====================
interface ContributionsChartProps {
    expenses: Expense[];
    currency: string;
}

export function ContributionsChart({ expenses, currency }: ContributionsChartProps) {
    const contributionData = useMemo(() => {
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

        return Array.from(paidMap.values())
            .map((item, idx) => ({
                ...item,
                name: item.name === "Unknown" ? "Unknown" : item.name.split(" ")[0],
                fill: CHART_COLORS[idx % CHART_COLORS.length],
            }))
            .sort((a, b) => b.amount - a.amount);
    }, [expenses]);

    if (contributionData.length === 0) {
        return <div className="h-[300px] flex items-center justify-center text-gray-500">No data</div>;
    }

    return (
        <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={contributionData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                    <XAxis
                        type="number"
                        tick={{ fontSize: 11 }}
                        className="fill-gray-500 dark:fill-gray-400"
                        tickFormatter={(value) => formatCurrency(value, currency).replace(/\.00$/, "")}
                    />
                    <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        className="fill-gray-500 dark:fill-gray-400"
                        width={80}
                    />
                    <Tooltip content={<CustomTooltip currency={currency} />} />
                    <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                        {contributionData.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.fill} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

// ==================== SPEND BY MEMBER CHART (Radar) ====================
interface SpendByMemberChartProps {
    expenses: Expense[];
    currency: string;
    currentUserId: string;
}

export function SpendByMemberChart({ expenses, currency, currentUserId }: SpendByMemberChartProps) {
    const spendData = useMemo(() => {
        const memberMap = new Map<string, { name: string; amount: number }>();

        expenses.forEach((expense) => {
            if (expense.splits && expense.splits.length > 0) {
                expense.splits.forEach((split) => {
                    const memberId = split.user_id || split.placeholder_id || "unknown";
                    const memberName = split.profile?.full_name
                        || split.placeholder?.name
                        || "Unknown";

                    if (!memberMap.has(memberId)) {
                        memberMap.set(memberId, { name: memberName, amount: 0 });
                    }
                    const current = memberMap.get(memberId)!;
                    current.amount += split.amount;
                });
            }
        });

        return Array.from(memberMap.entries())
            .map(([id, data]) => ({
                id,
                name: id === currentUserId ? "You" : (data.name === "Unknown" ? "Unknown" : data.name.split(" ")[0]),
                amount: data.amount,
                fullMark: Math.max(...Array.from(memberMap.values()).map(v => v.amount)) * 1.2,
            }))
            .sort((a, b) => b.amount - a.amount);
    }, [expenses, currentUserId]);

    if (spendData.length === 0) {
        return <div className="h-[300px] flex items-center justify-center text-gray-500">No split data</div>;
    }

    return (
        <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={spendData}>
                    <PolarGrid className="stroke-gray-200 dark:stroke-gray-700" />
                    <PolarAngleAxis
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        className="fill-gray-600 dark:fill-gray-400"
                    />
                    <PolarRadiusAxis
                        tick={{ fontSize: 9 }}
                        className="fill-gray-400"
                        tickFormatter={(value) => formatCurrency(value, currency).replace(/\.00$/, "")}
                    />
                    <Radar
                        name="Spend"
                        dataKey="amount"
                        stroke="#a855f7"
                        fill="#a855f7"
                        fillOpacity={0.5}
                        strokeWidth={2}
                    />
                    <Tooltip
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                return (
                                    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                                        <p className="text-xs text-gray-500 mb-1">{payload[0].payload.name}</p>
                                        <p className="text-sm font-semibold text-purple-600">
                                            {formatCurrency(payload[0].value as number, currency)}
                                        </p>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Legend />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
}

// ==================== BALANCES CHART (Vertical Bar) ====================
interface BalancesChartProps {
    balances: Balance[];
    currency: string;
    currentUserId: string;
}

export function BalancesChart({ balances, currency, currentUserId }: BalancesChartProps) {
    const balanceData = useMemo(() => {
        return balances
            .map((b) => ({
                name: b.user_id === currentUserId ? "You" : b.user_name.split(" ")[0],
                balance: b.balance,
                fill: b.balance >= 0 ? "#22c55e" : "#ef4444",
            }))
            .sort((a, b) => b.balance - a.balance);
    }, [balances, currentUserId]);

    if (balanceData.length === 0) {
        return <div className="h-[300px] flex items-center justify-center text-gray-500">No data</div>;
    }

    return (
        <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={balanceData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                    <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        className="fill-gray-500 dark:fill-gray-400"
                    />
                    <YAxis
                        tick={{ fontSize: 11 }}
                        className="fill-gray-500 dark:fill-gray-400"
                        tickFormatter={(value) => {
                            const sign = value >= 0 ? "+" : "";
                            return `${sign}${formatCurrency(Math.abs(value), currency).replace(/\.00$/, "")}`;
                        }}
                    />
                    <Tooltip content={<BalanceTooltip currency={currency} />} />
                    <Bar dataKey="balance" radius={[4, 4, 0, 0]}>
                        {balanceData.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.fill} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
