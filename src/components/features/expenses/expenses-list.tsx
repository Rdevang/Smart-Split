"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
    Search, Pencil, Trash2, X, Check, AlertTriangle,
    Utensils, Car, Film, Zap, Home, ShoppingBag, Plane,
    Heart, ShoppingCart, Receipt, UserCircle, Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/currency";
import { expensesService, type UpdateExpenseInput } from "@/services/expenses";
import type { Database } from "@/types/database";

type ExpenseCategory = Database["public"]["Enums"]["expense_category"];

interface Split {
    id: string;
    user_id: string | null;
    placeholder_id?: string | null;
    amount: number;
    is_settled?: boolean | null;
    profile?: { id: string; full_name: string | null; avatar_url: string | null } | null;
    placeholder?: { id: string; name: string; email: string | null } | null;
    is_placeholder?: boolean;
    participant_name?: string;
    participant_avatar?: string | null;
}

interface Expense {
    id: string;
    description: string;
    amount: number;
    category: ExpenseCategory | null;
    expense_date: string | null;
    paid_by: string | null;
    paid_by_placeholder_id?: string | null;
    paid_by_profile: { id: string; full_name: string | null; avatar_url: string | null } | null;
    paid_by_placeholder?: { id: string; name: string; email: string | null } | null;
    splits: Split[];
}

interface Member {
    id: string;
    user_id: string | null;
    role: string | null;
    is_placeholder?: boolean;
    profile: { id: string; email: string; full_name: string | null; avatar_url: string | null } | null;
    placeholder: { id: string; name: string } | null;
}

interface ExpensesListProps {
    groupId?: string;  // Reserved for future use
    expenses: Expense[];
    members?: Member[];  // Reserved for future use
    currentUserId: string;
    currency: string;
    isAdmin?: boolean;
}

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
    { value: "food", label: "Food & Dining" },
    { value: "transport", label: "Transport" },
    { value: "entertainment", label: "Entertainment" },
    { value: "utilities", label: "Utilities" },
    { value: "rent", label: "Rent" },
    { value: "shopping", label: "Shopping" },
    { value: "travel", label: "Travel" },
    { value: "healthcare", label: "Healthcare" },
    { value: "groceries", label: "Groceries" },
    { value: "other", label: "Other" },
];

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

export function ExpensesList({ expenses, currentUserId, currency, isAdmin = false }: ExpensesListProps) {
    const router = useRouter();
    const toast = useToast();

    // State
    const [searchQuery, setSearchQuery] = useState("");
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    // Edit form state
    const [editForm, setEditForm] = useState({
        description: "",
        amount: "",
        category: "" as ExpenseCategory | "",
        expense_date: "",
    });

    // Filter expenses
    const filteredExpenses = useMemo(() => {
        return expenses.filter((expense) => {
            const matchesSearch = expense.description.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = categoryFilter === "all" || expense.category === categoryFilter;
            return matchesSearch && matchesCategory;
        });
    }, [expenses, searchQuery, categoryFilter]);

    // Start editing
    const startEdit = (expense: Expense) => {
        setEditingExpense(expense);
        setEditForm({
            description: expense.description,
            amount: expense.amount.toString(),
            category: expense.category || "",
            expense_date: expense.expense_date?.split("T")[0] || "",
        });
    };

    // Cancel editing
    const cancelEdit = () => {
        setEditingExpense(null);
        setEditForm({ description: "", amount: "", category: "", expense_date: "" });
    };

    // Save edit
    const saveEdit = async () => {
        if (!editingExpense) return;

        setIsUpdating(true);
        try {
            const updates: UpdateExpenseInput = {};

            if (editForm.description !== editingExpense.description) {
                updates.description = editForm.description;
            }
            if (parseFloat(editForm.amount) !== editingExpense.amount) {
                updates.amount = parseFloat(editForm.amount);
            }
            if (editForm.category && editForm.category !== editingExpense.category) {
                updates.category = editForm.category as ExpenseCategory;
            }
            if (editForm.expense_date !== editingExpense.expense_date?.split("T")[0]) {
                updates.expense_date = editForm.expense_date;
            }

            if (Object.keys(updates).length === 0) {
                cancelEdit();
                return;
            }

            const result = await expensesService.updateExpense(editingExpense.id, updates, currentUserId);

            if (result.success) {
                toast.success("Expense updated successfully");
                cancelEdit();
                router.refresh();
            } else {
                toast.error(result.error || "Failed to update expense");
            }
        } catch {
            toast.error("Failed to update expense");
        } finally {
            setIsUpdating(false);
        }
    };

    // Delete expense
    const confirmDelete = async () => {
        if (!deletingExpense) return;

        setIsDeleting(true);
        try {
            const result = await expensesService.deleteExpense(deletingExpense.id, currentUserId);

            if (result.success) {
                toast.success("Expense deleted successfully");
                setDeletingExpense(null);
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

    const getPayerName = (expense: Expense) => {
        if (expense.paid_by === currentUserId) return "you";
        if (expense.paid_by_profile?.full_name) return expense.paid_by_profile.full_name;
        if (expense.paid_by_placeholder?.name) return expense.paid_by_placeholder.name;
        return "Unknown";
    };

    if (expenses.length === 0) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center py-12">
                    <Receipt className="h-12 w-12 text-gray-300 dark:text-gray-600" />
                    <p className="mt-4 text-gray-500 dark:text-gray-400">No expenses yet</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                        placeholder="Search expenses..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-gray-400" />
                    <Select
                        value={categoryFilter}
                        onChange={(value) => setCategoryFilter(value)}
                        className="w-40"
                        options={[
                            { value: "all", label: "All Categories" },
                            ...CATEGORIES,
                        ]}
                    />
                </div>
            </div>

            {/* Results count */}
            <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing {filteredExpenses.length} of {expenses.length} expenses
            </p>

            {/* Expenses */}
            <div className="space-y-3">
                {filteredExpenses.map((expense) => {
                    const category = expense.category || "other";
                    const paidByUser = expense.paid_by === currentUserId;
                    const userSplit = expense.splits.find((s) => s.user_id === currentUserId);
                    const userOwes = userSplit && !paidByUser ? userSplit.amount : 0;
                    const userIsOwed = paidByUser ? expense.amount - (userSplit?.amount || 0) : 0;
                    const isEditing = editingExpense?.id === expense.id;

                    return (
                        <Card key={expense.id} className="transition-all hover:shadow-md">
                            <CardContent className="p-4">
                                {isEditing ? (
                                    /* Edit Mode */
                                    <div className="space-y-4">
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <div>
                                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                    Description
                                                </label>
                                                <Input
                                                    value={editForm.description}
                                                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                                    placeholder="What was this expense for?"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                    Amount
                                                </label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    value={editForm.amount}
                                                    onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                                                    placeholder="0.00"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                    Category
                                                </label>
                                                <Select
                                                    value={editForm.category}
                                                    onChange={(value) => setEditForm({ ...editForm, category: value as ExpenseCategory })}
                                                    options={CATEGORIES}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                    Date
                                                </label>
                                                <Input
                                                    type="date"
                                                    value={editForm.expense_date}
                                                    onChange={(e) => setEditForm({ ...editForm, expense_date: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <Button variant="outline" onClick={cancelEdit} disabled={isUpdating}>
                                                <X className="mr-2 h-4 w-4" />
                                                Cancel
                                            </Button>
                                            <Button onClick={saveEdit} disabled={isUpdating}>
                                                <Check className="mr-2 h-4 w-4" />
                                                {isUpdating ? "Saving..." : "Save Changes"}
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    /* View Mode */
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
                                                        {expense.expense_date && new Date(expense.expense_date).toLocaleDateString("en-US", {
                                                            month: "short",
                                                            day: "numeric",
                                                            year: "numeric"
                                                        })} • Paid by <span className="font-medium">{getPayerName(expense)}</span>
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-semibold text-gray-900 dark:text-white">
                                                        {formatCurrency(expense.amount, currency)}
                                                    </p>
                                                    {userOwes > 0 && (
                                                        <p className="text-sm text-red-600 dark:text-red-400">
                                                            You owe {formatCurrency(userOwes, currency)}
                                                        </p>
                                                    )}
                                                    {userIsOwed > 0 && (
                                                        <p className="text-sm text-green-600 dark:text-green-400">
                                                            You get back {formatCurrency(userIsOwed, currency)}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Splits */}
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {expense.splits.map((split) => {
                                                    const isPlaceholder = split.is_placeholder === true || !!split.placeholder_id;
                                                    const isCurrentUser = split.user_id === currentUserId;
                                                    const name = isCurrentUser
                                                        ? "You"
                                                        : split.profile?.full_name?.split(" ")[0]
                                                        || split.placeholder?.name?.split(" ")[0]
                                                        || "Unknown";
                                                    const avatarUrl = split.profile?.avatar_url;

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
                                                                    className="h-4 w-4 rounded-full object-cover"
                                                                    unoptimized
                                                                />
                                                            ) : isPlaceholder ? (
                                                                <UserCircle className="h-4 w-4 text-gray-400" />
                                                            ) : (
                                                                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-teal-500 text-[10px] text-white">
                                                                    {name[0]?.toUpperCase() || "?"}
                                                                </div>
                                                            )}
                                                            <span className="text-gray-600 dark:text-gray-300">{name}</span>
                                                            <span className="font-medium text-gray-900 dark:text-white">
                                                                {formatCurrency(split.amount, currency)}
                                                            </span>
                                                            {isPlaceholder && (
                                                                <Badge variant="warning" className="ml-1 text-[10px]">Pending</Badge>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Actions - Show for expenses user paid OR if user is admin */}
                                        {(paidByUser || isAdmin) && (
                                            <div className="flex gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0"
                                                    onClick={() => startEdit(expense)}
                                                    title="Edit expense"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                                                    onClick={() => setDeletingExpense(expense)}
                                                    title="Delete expense"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Delete Confirmation Modal */}
            {deletingExpense && (
                <>
                    <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setDeletingExpense(null)} />
                    <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800">
                        <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    Delete Expense?
                                </h3>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    Are you sure you want to delete &ldquo;{deletingExpense.description}&rdquo;?
                                    This will also remove all associated splits. This action cannot be undone.
                                </p>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <Button
                                variant="outline"
                                onClick={() => setDeletingExpense(null)}
                                disabled={isDeleting}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="danger"
                                onClick={confirmDelete}
                                disabled={isDeleting}
                            >
                                {isDeleting ? "Deleting..." : "Delete Expense"}
                            </Button>
                        </div>
                    </div>
                </>
            )}

            {filteredExpenses.length === 0 && expenses.length > 0 && (
                <Card>
                    <CardContent className="flex flex-col items-center py-8">
                        <Search className="h-8 w-8 text-gray-300 dark:text-gray-600" />
                        <p className="mt-3 text-gray-500 dark:text-gray-400">No expenses match your search</p>
                        <Button
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={() => {
                                setSearchQuery("");
                                setCategoryFilter("all");
                            }}
                        >
                            Clear filters
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

