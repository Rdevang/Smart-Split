"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Receipt, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { ExpenseCard, type ExpenseCardExpense } from "./expense-card";
import { EditExpenseModal } from "./edit-expense-modal";
import { expensesService } from "@/services/expenses";
import { formatCurrency } from "@/lib/currency";

interface Group {
    id: string;
    name: string;
}

interface ExpensesPageWrapperProps {
    groups: Group[];
    expenses: ExpenseCardExpense[];
    totalOwed: number;
    totalOwe: number;
    currency: string;
    currentUserId: string;
}

export function ExpensesPageWrapper({
    groups,
    expenses: initialExpenses,
    totalOwed,
    totalOwe,
    currency,
    currentUserId,
}: ExpensesPageWrapperProps) {
    const router = useRouter();
    const toast = useToast();
    const [editingExpense, setEditingExpense] = useState<ExpenseCardExpense | null>(null);
    const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleEdit = (expense: ExpenseCardExpense) => {
        setEditingExpense(expense);
    };

    const handleEditSuccess = () => {
        setEditingExpense(null);
        router.refresh();
    };

    const handleDeleteClick = (expenseId: string) => {
        setDeletingExpenseId(expenseId);
    };

    const handleDeleteConfirm = async () => {
        if (!deletingExpenseId) return;

        setIsDeleting(true);
        try {
            const result = await expensesService.deleteExpense(deletingExpenseId, currentUserId);

            if (result.success) {
                toast.success("Expense deleted successfully");
                setDeletingExpenseId(null);
                router.refresh();
            } else {
                toast.error(result.error || "Failed to delete expense");
            }
        } catch {
            toast.error("Failed to delete expense");
        } finally {
            setIsDeleting(false);
        }
    };

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
                            {formatCurrency(totalOwed, currency)}
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
                    <CardContent className="p-6">
                        <p className="text-sm font-medium text-red-700 dark:text-red-300">You owe</p>
                        <p className="mt-2 text-3xl font-bold text-red-600 dark:text-red-400">
                            {formatCurrency(totalOwe, currency)}
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

                {initialExpenses.length === 0 ? (
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
                        {initialExpenses.map((expense) => (
                            <ExpenseCard
                                key={expense.id}
                                expense={expense}
                                currentUserId={currentUserId}
                                currency={currency}
                                onEdit={handleEdit}
                                onDelete={handleDeleteClick}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Edit Expense Modal */}
            {editingExpense && (
                <EditExpenseModal
                    expense={editingExpense}
                    currentUserId={currentUserId}
                    onClose={() => setEditingExpense(null)}
                    onSuccess={handleEditSuccess}
                />
            )}

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={!!deletingExpenseId}
                onClose={() => setDeletingExpenseId(null)}
                title="Delete Expense"
                description="Are you sure you want to delete this expense? This action cannot be undone."
            >
                <div className="flex gap-3 pt-4">
                    <Button
                        variant="outline"
                        onClick={() => setDeletingExpenseId(null)}
                        className="flex-1"
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleDeleteConfirm}
                        disabled={isDeleting}
                        className="flex-1"
                    >
                        {isDeleting ? "Deleting..." : "Delete"}
                    </Button>
                </div>
            </Dialog>
        </div>
    );
}
