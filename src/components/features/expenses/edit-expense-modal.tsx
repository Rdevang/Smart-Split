"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { expensesService, type UpdateExpenseInput } from "@/services/expenses";
import type { ExpenseCardExpense } from "./expense-card";
import type { Database } from "@/types/database";

type ExpenseCategory = Database["public"]["Enums"]["expense_category"];

const editExpenseSchema = z.object({
    description: z.string().min(1, "Description is required").max(200, "Description too long"),
    amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Amount must be greater than 0"),
    category: z.string(),
    expense_date: z.string().optional(),
    notes: z.string().max(500, "Notes too long").optional(),
});

type EditExpenseFormData = z.infer<typeof editExpenseSchema>;

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

interface EditExpenseModalProps {
    expense: ExpenseCardExpense;
    currentUserId: string;
    onClose: () => void;
    onSuccess: () => void;
}

export function EditExpenseModal({ expense, currentUserId, onClose, onSuccess }: EditExpenseModalProps) {
    const toast = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<EditExpenseFormData>({
        resolver: zodResolver(editExpenseSchema),
        defaultValues: {
            description: expense.description,
            amount: expense.amount.toString(),
            category: expense.category || "other",
            expense_date: expense.expense_date || new Date().toISOString().split("T")[0],
            notes: expense.notes || "",
        },
    });

    const onSubmit = async (data: EditExpenseFormData) => {
        setIsSubmitting(true);

        try {
            const updateData: UpdateExpenseInput = {
                description: data.description,
                amount: parseFloat(data.amount),
                category: data.category as ExpenseCategory,
                expense_date: data.expense_date,
                notes: data.notes || undefined,
            };

            const result = await expensesService.updateExpense(expense.id, updateData, currentUserId);

            if (result.success) {
                toast.success("Expense updated successfully");
                onSuccess();
            } else {
                toast.error(result.error || "Failed to update expense");
            }
        } catch {
            toast.error("Failed to update expense");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                >
                    <X className="h-5 w-5" />
                </button>

                <h2 className="mb-6 text-xl font-semibold text-gray-900 dark:text-white">
                    Edit Expense
                </h2>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    {/* Description */}
                    <div>
                        <Input
                            label="Description"
                            {...register("description")}
                            error={errors.description?.message}
                        />
                    </div>

                    {/* Amount */}
                    <div>
                        <Input
                            label="Amount"
                            type="number"
                            step="0.01"
                            {...register("amount")}
                            error={errors.amount?.message}
                        />
                    </div>

                    {/* Category */}
                    <div>
                        <Select
                            label="Category"
                            options={categoryOptions}
                            {...register("category")}
                            error={errors.category?.message}
                        />
                    </div>

                    {/* Date */}
                    <div>
                        <Input
                            label="Date"
                            type="date"
                            {...register("expense_date")}
                            error={errors.expense_date?.message}
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <Textarea
                            label="Notes (optional)"
                            rows={2}
                            {...register("notes")}
                            error={errors.notes?.message}
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            className="flex-1"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1"
                        >
                            {isSubmitting ? "Saving..." : "Save Changes"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
