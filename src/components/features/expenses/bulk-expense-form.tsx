"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Plus, Trash2, Loader2, ArrowLeft, CheckCircle2, ListPlus, Users, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { onExpenseMutation, getEncryptedGroupUrl } from "@/app/(dashboard)/actions";
import type { Database } from "@/types/database";
import { cn } from "@/lib/utils";

type ExpenseCategory = Database["public"]["Enums"]["expense_category"];

interface GroupMember {
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
    placeholder?: {
        id: string;
        name: string;
        email: string | null;
    } | null;
}

interface BulkExpenseFormGroup {
    id: string;
    name: string;
    members: GroupMember[];
}

interface ExpenseRow {
    id: string;
    description: string;
    amount: string;
    paid_by: string;
    category: ExpenseCategory;
    expense_date: string;
    split_among: string[]; // Member IDs to split this expense among
    isExpanded: boolean; // UI state for showing/hiding split selection
}

interface BulkExpenseFormProps {
    group: BulkExpenseFormGroup;
    userId: string;
}

const categoryOptions = [
    { value: "food", label: "🍕 Food" },
    { value: "transport", label: "🚗 Transport" },
    { value: "entertainment", label: "🎬 Entertainment" },
    { value: "utilities", label: "⚡ Utilities" },
    { value: "rent", label: "🏠 Rent" },
    { value: "shopping", label: "🛍️ Shopping" },
    { value: "travel", label: "✈️ Travel" },
    { value: "healthcare", label: "❤️ Healthcare" },
    { value: "groceries", label: "🛒 Groceries" },
    { value: "other", label: "📋 Other" },
];

const getMemberId = (member: GroupMember): string => {
    if (member.is_placeholder && member.placeholder) {
        return `placeholder:${member.placeholder.id}`;
    }
    return member.user_id || member.id;
};

const getMemberName = (member: GroupMember, currentUserId: string): string => {
    if (member.is_placeholder && member.placeholder) {
        return member.placeholder.name;
    }
    if (member.user_id === currentUserId) {
        return "You";
    }
    return member.profile?.full_name || member.profile?.email || "Unknown";
};

export function BulkExpenseForm({ group, userId }: BulkExpenseFormProps) {
    const router = useRouter();
    const toast = useToast();
    
    // Get all member IDs for default selection
    const allMemberIds = group.members.map(getMemberId);
    
    const createEmptyRow = useCallback((): ExpenseRow => ({
        id: crypto.randomUUID(),
        description: "",
        amount: "",
        paid_by: "",
        category: "other",
        expense_date: new Date().toISOString().split("T")[0],
        split_among: [...allMemberIds], // Default to all members
        isExpanded: false,
    }), [allMemberIds]);
    
    const [expenses, setExpenses] = useState<ExpenseRow[]>([createEmptyRow()]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Member options for payer dropdown
    const memberOptions = group.members.map((member) => ({
        value: getMemberId(member),
        label: getMemberName(member, userId),
    }));

    const addRow = useCallback(() => {
        setExpenses((prev) => [...prev, createEmptyRow()]);
    }, [createEmptyRow]);

    const removeRow = useCallback((id: string) => {
        setExpenses((prev) => {
            if (prev.length === 1) return prev;
            return prev.filter((e) => e.id !== id);
        });
    }, []);

    const updateRow = useCallback((id: string, field: keyof ExpenseRow, value: unknown) => {
        setExpenses((prev) =>
            prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
        );
        setErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors[`${id}-${field}`];
            return newErrors;
        });
    }, []);

    const toggleMemberInExpense = useCallback((expenseId: string, memberId: string) => {
        setExpenses((prev) =>
            prev.map((e) => {
                if (e.id !== expenseId) return e;
                const isSelected = e.split_among.includes(memberId);
                return {
                    ...e,
                    split_among: isSelected
                        ? e.split_among.filter((id) => id !== memberId)
                        : [...e.split_among, memberId],
                };
            })
        );
    }, []);

    const toggleExpanded = useCallback((id: string) => {
        setExpenses((prev) =>
            prev.map((e) => (e.id === id ? { ...e, isExpanded: !e.isExpanded } : e))
        );
    }, []);

    const validateExpenses = (): boolean => {
        const newErrors: Record<string, string> = {};

        expenses.forEach((expense) => {
            if (!expense.description.trim()) {
                newErrors[`${expense.id}-description`] = "Required";
            }
            if (!expense.amount || parseFloat(expense.amount) <= 0) {
                newErrors[`${expense.id}-amount`] = "Invalid";
            }
            if (!expense.paid_by) {
                newErrors[`${expense.id}-paid_by`] = "Required";
            }
            if (expense.split_among.length === 0) {
                newErrors[`${expense.id}-split`] = "Select at least one member";
            }
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validateExpenses()) {
            toast.error("Please fix the errors before submitting");
            return;
        }

        setIsSubmitting(true);

        try {
            // Prepare expenses with their individual splits
            const expenseData = expenses.map((e) => {
                const paidBy = e.paid_by;
                const isPlaceholder = paidBy.startsWith("placeholder:");
                
                // Prepare split_among for this expense
                const splitAmong = e.split_among.map((memberId) => {
                    if (memberId.startsWith("placeholder:")) {
                        return { placeholder_id: memberId.replace("placeholder:", "") };
                    }
                    return { user_id: memberId };
                });
                
                return {
                    description: e.description.trim(),
                    amount: parseFloat(e.amount),
                    category: e.category,
                    expense_date: e.expense_date,
                    split_among: splitAmong,
                    ...(isPlaceholder
                        ? { paid_by_placeholder_id: paidBy.replace("placeholder:", "") }
                        : { paid_by: paidBy }),
                };
            });

            const response = await fetch("/api/expenses/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    group_id: group.id,
                    split_type: "equal",
                    expenses: expenseData,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Failed to create expenses");
            }

            // Trigger cache invalidation
            const allPayers = expenses
                .map((e) => e.paid_by)
                .filter((id) => !id.startsWith("placeholder:"));
            const allMemberIds = expenses
                .flatMap((e) => e.split_among)
                .filter((id) => !id.startsWith("placeholder:"));
            
            await onExpenseMutation(
                group.id,
                allPayers[0] || "",
                [...new Set([...allPayers, ...allMemberIds])]
            );

            toast.success(`Created ${result.count} expenses`);

            // Navigate back to group page with fresh data
            const groupUrl = await getEncryptedGroupUrl(group.id);
            router.refresh(); // Refresh cache first
            router.push(groupUrl); // Then navigate

        } catch (error) {
            console.error("Bulk create error:", error);
            toast.error(error instanceof Error ? error.message : "Failed to create expenses");
        } finally {
            setIsSubmitting(false);
        }
    };

    const totalAmount = expenses.reduce(
        (sum, e) => sum + (parseFloat(e.amount) || 0),
        0
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 shadow-lg shadow-teal-500/25">
                                <ListPlus className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Add Multiple Expenses</CardTitle>
                                <CardDescription className="text-sm">
                                    Add several expenses at once for {group.name}
                                </CardDescription>
                            </div>
                        </div>
                        <div className="text-left sm:text-right pl-13 sm:pl-0">
                            <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
                            <p className="text-2xl font-bold text-teal-600 dark:text-teal-400">
                                ₹{totalAmount.toFixed(2)}
                            </p>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Expenses */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-base">Expenses ({expenses.length})</CardTitle>
                            <CardDescription>
                                Add expenses and select who to split each one among
                            </CardDescription>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addRow}
                            className="gap-1"
                        >
                            <Plus className="h-4 w-4" />
                            Add Row
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-gray-200 dark:divide-gray-800">
                        {expenses.map((expense, index) => (
                            <div key={expense.id} className="p-4 space-y-3">
                                {/* Main Row */}
                                <div className="flex gap-3 items-end">
                                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                                        {/* Description */}
                                        <div className="sm:col-span-2 lg:col-span-1">
                                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                                                Description
                                            </label>
                                            <Input
                                                placeholder={`Expense ${index + 1}`}
                                                value={expense.description}
                                                onChange={(e) => updateRow(expense.id, "description", e.target.value)}
                                                className={cn(
                                                    "text-sm",
                                                    errors[`${expense.id}-description`] && "border-red-500"
                                                )}
                                            />
                                        </div>

                                        {/* Amount */}
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                                                Amount
                                            </label>
                                            <Input
                                                type="number"
                                                placeholder="0.00"
                                                value={expense.amount}
                                                onChange={(e) => updateRow(expense.id, "amount", e.target.value)}
                                                className={cn(
                                                    "text-sm",
                                                    errors[`${expense.id}-amount`] && "border-red-500"
                                                )}
                                            />
                                        </div>

                                        {/* Paid By */}
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                                                Paid By
                                            </label>
                                            <Select
                                                value={expense.paid_by}
                                                onChange={(value) => updateRow(expense.id, "paid_by", value)}
                                                options={memberOptions}
                                                placeholder="Select"
                                                className={cn(
                                                    "text-sm",
                                                    errors[`${expense.id}-paid_by`] && "border-red-500"
                                                )}
                                            />
                                        </div>

                                        {/* Category */}
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                                                Category
                                            </label>
                                            <Select
                                                value={expense.category}
                                                onChange={(value) => updateRow(expense.id, "category", value as ExpenseCategory)}
                                                options={categoryOptions}
                                                className="text-sm"
                                            />
                                        </div>

                                        {/* Date */}
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                                                Date
                                            </label>
                                            <Input
                                                type="date"
                                                value={expense.expense_date}
                                                onChange={(e) => updateRow(expense.id, "expense_date", e.target.value)}
                                                className="text-sm"
                                            />
                                        </div>
                                    </div>

                                    {/* Delete Button - Always aligned to the right */}
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeRow(expense.id)}
                                        disabled={expenses.length === 1}
                                        className="text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 h-12 w-12 shrink-0"
                                    >
                                        <Trash2 className="h-5 w-5" />
                                    </Button>
                                </div>

                                {/* Split Among Section */}
                                <div className="pt-2">
                                    <button
                                        type="button"
                                        onClick={() => toggleExpanded(expense.id)}
                                        className={cn(
                                            "flex items-center gap-2 text-sm font-medium transition-colors w-full justify-between p-2 rounded-lg",
                                            errors[`${expense.id}-split`]
                                                ? "text-red-600 bg-red-50 dark:bg-red-950/30"
                                                : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Users className="h-4 w-4" />
                                            <span>
                                                Split among {expense.split_among.length} of {group.members.length} members
                                            </span>
                                            {errors[`${expense.id}-split`] && (
                                                <span className="text-red-500 text-xs">
                                                    ({errors[`${expense.id}-split`]})
                                                </span>
                                            )}
                                        </div>
                                        {expense.isExpanded ? (
                                            <ChevronUp className="h-4 w-4" />
                                        ) : (
                                            <ChevronDown className="h-4 w-4" />
                                        )}
                                    </button>

                                    {expense.isExpanded && (
                                        <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                                            <div className="flex flex-wrap gap-2">
                                                {group.members.map((member) => {
                                                    const memberId = getMemberId(member);
                                                    const isSelected = expense.split_among.includes(memberId);
                                                    const name = getMemberName(member, userId);

                                                    return (
                                                        <button
                                                            key={memberId}
                                                            type="button"
                                                            onClick={() => toggleMemberInExpense(expense.id, memberId)}
                                                            className={cn(
                                                                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",
                                                                isSelected
                                                                    ? "bg-teal-100 border-teal-300 text-teal-700 dark:bg-teal-950 dark:border-teal-700 dark:text-teal-300"
                                                                    : "bg-white border-gray-200 text-gray-500 hover:border-gray-300 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400"
                                                            )}
                                                        >
                                                            {member.profile?.avatar_url ? (
                                                                <Image
                                                                    src={member.profile.avatar_url}
                                                                    alt={name}
                                                                    width={18}
                                                                    height={18}
                                                                    className="rounded-full"
                                                                />
                                                            ) : (
                                                                <div className={cn(
                                                                    "w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-medium",
                                                                    isSelected 
                                                                        ? "bg-teal-200 text-teal-700 dark:bg-teal-800 dark:text-teal-200"
                                                                        : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                                                                )}>
                                                                    {name.charAt(0).toUpperCase()}
                                                                </div>
                                                            )}
                                                            {name}
                                                            {isSelected && (
                                                                <CheckCircle2 className="h-3 w-3 text-teal-600 dark:text-teal-400" />
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <div className="mt-2 flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => updateRow(expense.id, "split_among", [...allMemberIds])}
                                                    className="text-xs text-teal-600 hover:text-teal-700 dark:text-teal-400"
                                                >
                                                    Select all
                                                </button>
                                                <span className="text-gray-300 dark:text-gray-600">|</span>
                                                <button
                                                    type="button"
                                                    onClick={() => updateRow(expense.id, "split_among", [])}
                                                    className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400"
                                                >
                                                    Clear all
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Add Row Button (Mobile) */}
                    <div className="p-4 border-t border-gray-200 dark:border-gray-800 lg:hidden">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={addRow}
                            className="w-full gap-2"
                        >
                            <Plus className="h-4 w-4" />
                            Add Another Expense
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex items-center justify-between gap-4">
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                    disabled={isSubmitting}
                    className="gap-2"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Cancel
                </Button>

                <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                        {expenses.length} expense{expenses.length !== 1 ? "s" : ""} •{" "}
                        <span className="font-semibold text-teal-600 dark:text-teal-400">
                            ₹{totalAmount.toFixed(2)}
                        </span>
                    </span>
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="gap-2 min-w-[140px]"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Creating...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="h-4 w-4" />
                                Create All
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
