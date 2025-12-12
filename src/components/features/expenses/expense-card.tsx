"use client";

import { useState } from "react";
import Image from "next/image";
import {
    Utensils, Car, Film, Zap, Home, ShoppingBag, Plane,
    Heart, ShoppingCart, MoreHorizontal, Trash2, Receipt, UserCircle
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Database } from "@/types/database";

type ExpenseCategory = Database["public"]["Enums"]["expense_category"];

// Generic type that works with both server and client expense types
interface Split {
    id: string;
    user_id: string | null;
    placeholder_id?: string | null;
    amount: number;
    is_settled?: boolean | null;
    profile?: {
        id: string;
        full_name: string | null;
        avatar_url: string | null;
    } | null;
    placeholder?: {
        id: string;
        name: string;
        email: string | null;
    } | null;
    is_placeholder?: boolean;
    participant_name?: string;
    participant_avatar?: string | null;
}

interface ExpenseCardExpense {
    id: string;
    description: string;
    amount: number;
    category: ExpenseCategory | null;
    expense_date: string | null;
    paid_by: string;
    paid_by_profile: {
        id: string;
        full_name: string | null;
        avatar_url: string | null;
    } | null;
    splits: Split[];
}

interface ExpenseCardProps {
    expense: ExpenseCardExpense;
    currentUserId: string;
    onDelete?: (expenseId: string) => void;
}

const categoryIcons: Record<ExpenseCategory, React.ReactNode> = {
    food: <Utensils className="h-5 w-5" />,
    transport: <Car className="h-5 w-5" />,
    entertainment: <Film className="h-5 w-5" />,
    utilities: <Zap className="h-5 w-5" />,
    rent: <Home className="h-5 w-5" />,
    shopping: <ShoppingBag className="h-5 w-5" />,
    travel: <Plane className="h-5 w-5" />,
    healthcare: <Heart className="h-5 w-5" />,
    groceries: <ShoppingCart className="h-5 w-5" />,
    other: <Receipt className="h-5 w-5" />,
};

const categoryColors: Record<ExpenseCategory, string> = {
    food: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
    transport: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    entertainment: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
    utilities: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400",
    rent: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
    shopping: "bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400",
    travel: "bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400",
    healthcare: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
    groceries: "bg-lime-100 text-lime-600 dark:bg-lime-900/30 dark:text-lime-400",
    other: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

function getSplitDisplayInfo(split: Split, currentUserId: string) {
    // Use truthy check for placeholder_id to handle both undefined and null
    const isPlaceholder = split.is_placeholder === true || !!split.placeholder_id;
    const isCurrentUser = split.user_id === currentUserId;

    let name: string;
    let avatarUrl: string | null = null;

    if (isCurrentUser) {
        name = "You";
        // Still show the current user's avatar
        avatarUrl = split.participant_avatar || split.profile?.avatar_url || null;
    } else if (split.participant_name) {
        name = split.participant_name.split(" ")[0];
        avatarUrl = split.participant_avatar || null;
    } else if (split.profile) {
        name = split.profile.full_name?.split(" ")[0] || "Unknown";
        avatarUrl = split.profile.avatar_url;
    } else if (split.placeholder) {
        name = split.placeholder.name.split(" ")[0];
    } else {
        name = "Unknown";
    }

    return { name, avatarUrl, isPlaceholder, isCurrentUser };
}

export function ExpenseCard({ expense, currentUserId, onDelete }: ExpenseCardProps) {
    const [showActions, setShowActions] = useState(false);
    const category = expense.category || "other";
    const paidByUser = expense.paid_by === currentUserId;

    const userSplit = expense.splits.find((s) => s.user_id === currentUserId);
    const userOwes = userSplit && !paidByUser ? userSplit.amount : 0;
    const userIsOwed = paidByUser ? expense.amount - (userSplit?.amount || 0) : 0;

    const formattedDate = expense.expense_date
        ? new Date(expense.expense_date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
        })
        : "";

    return (
        <Card className="group transition-all hover:shadow-md">
            <CardContent className="p-4">
                <div className="flex items-start gap-4">
                    {/* Category Icon */}
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${categoryColors[category]}`}>
                        {categoryIcons[category]}
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <h4 className="font-medium text-gray-900 dark:text-white">
                                    {expense.description}
                                </h4>
                                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                                    {formattedDate} • Paid by{" "}
                                    <span className="font-medium">
                                        {paidByUser ? "you" : expense.paid_by_profile?.full_name || "Unknown"}
                                    </span>
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="font-semibold text-gray-900 dark:text-white">
                                    ${expense.amount.toFixed(2)}
                                </p>
                                {userOwes > 0 && (
                                    <p className="text-sm text-red-600 dark:text-red-400">
                                        You owe ${userOwes.toFixed(2)}
                                    </p>
                                )}
                                {userIsOwed > 0 && (
                                    <p className="text-sm text-green-600 dark:text-green-400">
                                        You get back ${userIsOwed.toFixed(2)}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Splits */}
                        <div className="mt-3 flex flex-wrap gap-2">
                            {expense.splits.map((split) => {
                                const { name, avatarUrl, isPlaceholder } = getSplitDisplayInfo(split, currentUserId);

                                return (
                                    <div
                                        key={split.id}
                                        className="flex items-center gap-1.5 rounded-full bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800"
                                    >
                                        {avatarUrl ? (
                                            <Image
                                                src={avatarUrl}
                                                alt={name}
                                                width={16}
                                                height={16}
                                                className="rounded-full"
                                                unoptimized
                                            />
                                        ) : isPlaceholder ? (
                                            <UserCircle className="h-4 w-4 text-gray-400" />
                                        ) : (
                                            <div className="flex h-4 w-4 items-center justify-center rounded-full bg-teal-500 text-[10px] text-white">
                                                {name[0]?.toUpperCase() || "?"}
                                            </div>
                                        )}
                                        <span className="text-gray-600 dark:text-gray-300">
                                            {name}
                                        </span>
                                        <span className="font-medium text-gray-900 dark:text-white">
                                            ${split.amount.toFixed(2)}
                                        </span>
                                        {isPlaceholder && (
                                            <Badge variant="warning" className="ml-1 text-[10px]">
                                                Pending
                                            </Badge>
                                        )}
                                        {split.is_settled && (
                                            <Badge variant="success" className="ml-1 text-[10px]">
                                                Settled
                                            </Badge>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Actions */}
                    {paidByUser && onDelete && (
                        <div className="relative">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100"
                                onClick={() => setShowActions(!showActions)}
                            >
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                            {showActions && (
                                <div className="absolute right-0 top-8 z-10 w-32 rounded-lg border bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                                    <button
                                        onClick={() => {
                                            onDelete(expense.id);
                                            setShowActions(false);
                                        }}
                                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        Delete
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
