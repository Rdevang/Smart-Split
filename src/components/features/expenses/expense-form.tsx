"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { expensesService } from "@/services/expenses";
import { onExpenseMutation } from "@/app/(dashboard)/actions";
import type { Database } from "@/types/database";

type ExpenseCategory = Database["public"]["Enums"]["expense_category"];
type SplitType = Database["public"]["Enums"]["split_type"];

// Generic member type that works with both client and server services
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

interface ExpenseFormGroup {
    id: string;
    name: string;
    members: GroupMember[];
}

const expenseSchema = z.object({
    description: z.string().min(1, "Description is required").max(200, "Description too long"),
    amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Amount must be greater than 0"),
    paid_by: z.string().min(1, "Select who paid"),
    category: z.string(),
    split_type: z.string(),
    expense_date: z.string().optional(),
    notes: z.string().max(500, "Notes too long").optional(),
});

type ExpenseFormData = z.infer<typeof expenseSchema>;

interface ExpenseFormProps {
    group: ExpenseFormGroup;
    userId: string;
}

const categoryOptions = [
    { value: "food", label: "🍕 Food & Drinks" },
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

const splitTypeOptions = [
    { value: "equal", label: "Split Equally" },
    { value: "exact", label: "Exact Amounts" },
    { value: "percentage", label: "By Percentage" },
];

// Helper to get member ID (user_id for real users, placeholder.id for placeholders)
const getMemberId = (member: GroupMember): string => {
    if (member.is_placeholder && member.placeholder) {
        return `placeholder:${member.placeholder.id}`;
    }
    return member.user_id || member.id;
};

// Helper to get member display name
const getMemberName = (member: GroupMember, currentUserId: string): string => {
    if (member.is_placeholder && member.placeholder) {
        return member.placeholder.name;
    }
    if (member.user_id === currentUserId) return "You";
    return member.profile?.full_name || member.profile?.email || "Unknown";
};

export function ExpenseForm({ group, userId }: ExpenseFormProps) {
    const router = useRouter();
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [splitType, setSplitType] = useState<SplitType>("equal");
    const [selectedMembers, setSelectedMembers] = useState<string[]>(
        group.members.map((m) => getMemberId(m))
    );
    const [customSplits, setCustomSplits] = useState<Record<string, number>>({});

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors },
    } = useForm<ExpenseFormData>({
        resolver: zodResolver(expenseSchema),
        defaultValues: {
            description: "",
            amount: "",
            paid_by: userId,
            category: "other",
            split_type: "equal",
            expense_date: new Date().toISOString().split("T")[0],
            notes: "",
        },
    });

    const amount = watch("amount");
    const paidBy = watch("paid_by");

    // All members can be "paid by" (including placeholders)
    const paidByOptions = group.members.map((m) => ({
        value: getMemberId(m),
        label: getMemberName(m, userId),
    }));

    // Calculate equal splits when amount or selected members change
    useEffect(() => {
        if (splitType === "equal" && amount && selectedMembers.length > 0) {
            const splitAmount = Number(amount) / selectedMembers.length;
            const newSplits: Record<string, number> = {};
            selectedMembers.forEach((memberId) => {
                newSplits[memberId] = Math.round(splitAmount * 100) / 100;
            });
            setCustomSplits(newSplits);
        }
    }, [amount, selectedMembers, splitType]);

    const toggleMember = (memberId: string) => {
        setSelectedMembers((prev) =>
            prev.includes(memberId)
                ? prev.filter((id) => id !== memberId)
                : [...prev, memberId]
        );
    };

    const handleSplitChange = (memberId: string, value: string) => {
        let numValue = Number(value) || 0;
        
        // Cap at 100 for percentage mode
        if (splitType === "percentage" && numValue > 100) {
            numValue = 100;
        }
        
        // Don't allow negative values
        if (numValue < 0) {
            numValue = 0;
        }
        
        setCustomSplits((prev) => ({
            ...prev,
            [memberId]: numValue,
        }));
    };

    const onSubmit = async (data: ExpenseFormData) => {
        setIsLoading(true);
        setError(null);

        const totalAmount = Number(data.amount);

        // For percentage splits, validate that percentages add up to 100
        if (splitType === "percentage") {
            const percentageTotal = Object.values(customSplits).reduce((sum, val) => sum + val, 0);
            if (Math.abs(percentageTotal - 100) > 0.01) {
                setError(`Percentages must add up to 100% (currently ${percentageTotal.toFixed(1)}%)`);
                setIsLoading(false);
                return;
            }
        }

        // Build splits array - handle both real users and placeholders
        const splits = selectedMembers.map((memberId) => {
            const isPlaceholder = memberId.startsWith("placeholder:");
            const actualId = isPlaceholder ? memberId.replace("placeholder:", "") : memberId;
            
            // For percentage splits, calculate actual amount from percentage
            const percentage = customSplits[memberId] || 0;
            const amount = splitType === "percentage" 
                ? Math.round((totalAmount * percentage / 100) * 100) / 100
                : percentage; // For equal/exact, customSplits already contains amounts

            return {
                user_id: isPlaceholder ? undefined : actualId,
                placeholder_id: isPlaceholder ? actualId : undefined,
                amount,
                percentage: splitType === "percentage" ? percentage : undefined,
            };
        });

        // Validate splits total (for non-percentage types)
        if (splitType !== "percentage") {
            const splitsTotal = splits.reduce((sum, s) => sum + s.amount, 0);
            if (Math.abs(splitsTotal - totalAmount) > 0.01) {
                setError(`Splits total ($${splitsTotal.toFixed(2)}) doesn't match expense amount ($${totalAmount.toFixed(2)})`);
                setIsLoading(false);
                return;
            }
        }

        try {
            // Determine if payer is a placeholder or registered user
            const isPayerPlaceholder = data.paid_by.startsWith("placeholder:");
            const payerId = isPayerPlaceholder 
                ? data.paid_by.replace("placeholder:", "") 
                : data.paid_by;

            const result = await expensesService.createExpense(
                {
                    group_id: group.id,
                    description: data.description,
                    amount: totalAmount,
                    paid_by: isPayerPlaceholder ? undefined : payerId,
                    paid_by_placeholder_id: isPayerPlaceholder ? payerId : undefined,
                    category: data.category as ExpenseCategory,
                    split_type: splitType,
                    expense_date: data.expense_date,
                    notes: data.notes,
                    splits,
                },
                userId
            );

            if (result.error) {
                setError(result.error);
                toast.error(result.error);
                return;
            }

            // Invalidate cache for the group and all affected members
            const participantIds = selectedMembers
                .filter((id) => !id.startsWith("placeholder:"))
                .map((id) => id);
            const paidByUserId = paidBy.startsWith("placeholder:") ? "" : paidBy;
            await onExpenseMutation(group.id, paidByUserId, participantIds);

            toast.success(`Expense "$${totalAmount.toFixed(2)}" added successfully!`);
            router.push(`/groups/${group.id}`);
            router.refresh();
        } catch {
            setError("An unexpected error occurred");
            toast.error("An unexpected error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    const splitsTotal = Object.values(customSplits).reduce((sum, val) => sum + val, 0);
    const amountNum = Number(amount) || 0;
    
    // For percentage splits, check if percentages add to 100
    // For other splits, check if amounts match total
    const isBalanced = splitType === "percentage"
        ? Math.abs(splitsTotal - 100) < 0.01
        : Math.abs(splitsTotal - amountNum) < 0.01;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Add Expense</CardTitle>
                <CardDescription>
                    Add a new expense to {group.name}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    {error && (
                        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                            {error}
                        </div>
                    )}

                    <div className="grid gap-6 md:grid-cols-2">
                        <Input
                            label="Description"
                            placeholder="e.g., Dinner at restaurant"
                            error={errors.description?.message}
                            {...register("description")}
                        />

                        <Input
                            label="Amount"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            error={errors.amount?.message}
                            {...register("amount")}
                        />
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        <Select
                            label="Paid by"
                            options={paidByOptions}
                            value={paidBy}
                            onChange={(value) => setValue("paid_by", value)}
                            error={errors.paid_by?.message}
                        />

                        <Select
                            label="Category"
                            options={categoryOptions}
                            value={watch("category")}
                            onChange={(value) => setValue("category", value)}
                        />
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        <Input
                            label="Date"
                            type="date"
                            {...register("expense_date")}
                        />

                        <Select
                            label="Split Type"
                            options={splitTypeOptions}
                            value={splitType}
                            onChange={(value) => setSplitType(value as SplitType)}
                        />
                    </div>

                    {/* Split Configuration */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                                Split Between
                            </label>
                            {(amountNum > 0 || splitType === "percentage") && (
                                <span className={`text-sm ${isBalanced ? "text-green-600" : "text-red-600"}`}>
                                    {splitType === "percentage" 
                                        ? `${splitsTotal.toFixed(1)}% / 100%`
                                        : `$${splitsTotal.toFixed(2)} / $${amountNum.toFixed(2)}`
                                    }
                                </span>
                            )}
                        </div>

                        <div className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                            {group.members.map((member) => {
                                const memberId = getMemberId(member);
                                const memberName = getMemberName(member, userId);
                                const isPlaceholder = member.is_placeholder;
                                const avatarUrl = member.profile?.avatar_url;
                                const initial = isPlaceholder
                                    ? member.placeholder?.name?.[0]?.toUpperCase()
                                    : member.profile?.full_name?.[0]?.toUpperCase();

                                return (
                                    <div key={memberId} className="flex items-center gap-4">
                                        <input
                                            type="checkbox"
                                            checked={selectedMembers.includes(memberId)}
                                            onChange={() => toggleMember(memberId)}
                                            className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                        />
                                        <div className="flex items-center gap-2 flex-1">
                                            {avatarUrl ? (
                                                <Image
                                                    src={avatarUrl}
                                                    alt={memberName}
                                                    width={32}
                                                    height={32}
                                                    className="h-8 w-8 rounded-full object-cover"
                                                    unoptimized
                                                />
                                            ) : (
                                                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm text-white ${isPlaceholder ? "bg-gray-400" : "bg-teal-500"
                                                    }`}>
                                                    {initial || "?"}
                                                </div>
                                            )}
                                            <span className="text-sm text-gray-700 dark:text-gray-300">
                                                {memberName}
                                                {isPlaceholder && (
                                                    <span className="ml-1 text-xs text-amber-600">(not signed up)</span>
                                                )}
                                            </span>
                                        </div>
                                        {selectedMembers.includes(memberId) && splitType !== "equal" && (
                                            <div className="flex items-center gap-2">
                                                <div className="relative w-24">
                                                    <Input
                                                        type="number"
                                                        step={splitType === "percentage" ? "1" : "0.01"}
                                                        min="0"
                                                        max={splitType === "percentage" ? "100" : undefined}
                                                        placeholder={splitType === "percentage" ? "0" : "0.00"}
                                                        value={customSplits[memberId] || ""}
                                                        onChange={(e) => handleSplitChange(memberId, e.target.value)}
                                                        className="h-9 text-sm pr-6"
                                                    />
                                                    {splitType === "percentage" && (
                                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                                                            %
                                                        </span>
                                                    )}
                                                </div>
                                                {splitType === "percentage" && amountNum > 0 && (
                                                    <span className="text-xs text-gray-500 dark:text-gray-400 w-16">
                                                        = ${((amountNum * (customSplits[memberId] || 0)) / 100).toFixed(2)}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        {selectedMembers.includes(memberId) && splitType === "equal" && (
                                            <span className="w-28 text-right text-sm font-medium text-gray-900 dark:text-white">
                                                ${(customSplits[memberId] || 0).toFixed(2)}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <Textarea
                        label="Notes (optional)"
                        placeholder="Any additional details..."
                        {...register("notes")}
                    />

                    <div className="flex gap-3 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => router.back()}
                            disabled={isLoading}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            isLoading={isLoading}
                            disabled={!isBalanced || selectedMembers.length === 0}
                        >
                            Add Expense
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}

