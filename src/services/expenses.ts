import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type Expense = Database["public"]["Tables"]["expenses"]["Row"];
type ExpenseSplit = Database["public"]["Tables"]["expense_splits"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type ExpenseCategory = Database["public"]["Enums"]["expense_category"];
type SplitType = Database["public"]["Enums"]["split_type"];

export interface ExpenseWithDetails extends Expense {
    paid_by_profile: Profile;
    splits: (ExpenseSplit & { profile: Profile })[];
}

export interface CreateExpenseInput {
    group_id: string;
    description: string;
    amount: number;
    paid_by: string;
    category?: ExpenseCategory;
    split_type: SplitType;
    expense_date?: string;
    notes?: string;
    splits: {
        user_id?: string;
        placeholder_id?: string;
        amount: number;
        percentage?: number;
    }[];
}

export interface UpdateExpenseInput {
    description?: string;
    amount?: number;
    category?: ExpenseCategory;
    expense_date?: string;
    notes?: string;
}

export const expensesService = {
    async getExpenses(groupId: string): Promise<ExpenseWithDetails[]> {
        const supabase = createClient();

        const { data: expenses, error } = await supabase
            .from("expenses")
            .select(`
                *,
                paid_by_profile:profiles!expenses_paid_by_fkey (*),
                expense_splits (
                    *,
                    profile:profiles (*)
                )
            `)
            .eq("group_id", groupId)
            .order("expense_date", { ascending: false });

        if (error || !expenses) {
            console.error("Error fetching expenses:", error);
            return [];
        }

        return expenses.map((expense) => ({
            ...expense,
            paid_by_profile: expense.paid_by_profile as Profile,
            splits: expense.expense_splits as (ExpenseSplit & { profile: Profile })[],
        }));
    },

    async getExpense(expenseId: string): Promise<ExpenseWithDetails | null> {
        const supabase = createClient();

        const { data: expense, error } = await supabase
            .from("expenses")
            .select(`
                *,
                paid_by_profile:profiles!expenses_paid_by_fkey (*),
                expense_splits (
                    *,
                    profile:profiles (*)
                )
            `)
            .eq("id", expenseId)
            .single();

        if (error || !expense) {
            console.error("Error fetching expense:", error);
            return null;
        }

        return {
            ...expense,
            paid_by_profile: expense.paid_by_profile as Profile,
            splits: expense.expense_splits as (ExpenseSplit & { profile: Profile })[],
        };
    },

    async getUserExpenses(userId: string, limit = 10): Promise<ExpenseWithDetails[]> {
        const supabase = createClient();

        // Get expenses where user paid or is in a split
        const { data: splitExpenseIds } = await supabase
            .from("expense_splits")
            .select("expense_id")
            .eq("user_id", userId);

        const expenseIdsFromSplits = splitExpenseIds?.map((s) => s.expense_id) || [];

        const { data: expenses, error } = await supabase
            .from("expenses")
            .select(`
                *,
                paid_by_profile:profiles!expenses_paid_by_fkey (*),
                expense_splits (
                    *,
                    profile:profiles (*)
                )
            `)
            .or(`paid_by.eq.${userId},id.in.(${expenseIdsFromSplits.join(",")})`)
            .order("expense_date", { ascending: false })
            .limit(limit);

        if (error || !expenses) {
            console.error("Error fetching user expenses:", error);
            return [];
        }

        return expenses.map((expense) => ({
            ...expense,
            paid_by_profile: expense.paid_by_profile as Profile,
            splits: expense.expense_splits as (ExpenseSplit & { profile: Profile })[],
        }));
    },

    async createExpense(
        input: CreateExpenseInput,
        createdBy: string
    ): Promise<{ expense: Expense | null; error?: string }> {
        const supabase = createClient();

        // Validate splits add up to total amount
        const splitsTotal = input.splits.reduce((sum, s) => sum + s.amount, 0);
        if (Math.abs(splitsTotal - input.amount) > 0.01) {
            return {
                expense: null,
                error: `Split amounts (${splitsTotal.toFixed(2)}) must equal total amount (${input.amount.toFixed(2)})`,
            };
        }

        // Create expense
        const { data: expense, error: expenseError } = await supabase
            .from("expenses")
            .insert({
                group_id: input.group_id,
                description: input.description,
                amount: input.amount,
                paid_by: input.paid_by,
                category: input.category || "other",
                split_type: input.split_type,
                expense_date: input.expense_date || new Date().toISOString().split("T")[0],
                notes: input.notes || null,
            })
            .select()
            .single();

        if (expenseError || !expense) {
            return { expense: null, error: expenseError?.message || "Failed to create expense" };
        }

        // Create splits
        const splitsToInsert = input.splits.map((split) => ({
            expense_id: expense.id,
            user_id: split.user_id || null,
            placeholder_id: split.placeholder_id || null,
            amount: split.amount,
            percentage: split.percentage || null,
        }));

        const { error: splitsError } = await supabase
            .from("expense_splits")
            .insert(splitsToInsert);

        if (splitsError) {
            // Rollback expense creation
            await supabase.from("expenses").delete().eq("id", expense.id);
            return { expense: null, error: splitsError.message };
        }

        // Update group's updated_at
        await supabase
            .from("groups")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", input.group_id);

        // Log activity
        await supabase.from("activities").insert({
            user_id: createdBy,
            group_id: input.group_id,
            entity_type: "expense",
            entity_id: expense.id,
            action: "created",
            metadata: {
                description: expense.description,
                amount: expense.amount,
            },
        });

        return { expense };
    },

    async updateExpense(
        expenseId: string,
        input: UpdateExpenseInput
    ): Promise<{ success: boolean; error?: string }> {
        const supabase = createClient();

        const { error } = await supabase
            .from("expenses")
            .update({
                ...input,
                updated_at: new Date().toISOString(),
            })
            .eq("id", expenseId);

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true };
    },

    async deleteExpense(
        expenseId: string,
        deletedBy: string
    ): Promise<{ success: boolean; error?: string }> {
        const supabase = createClient();

        // Get expense details for activity log
        const { data: expense } = await supabase
            .from("expenses")
            .select("group_id, description, amount")
            .eq("id", expenseId)
            .single();

        // Delete splits first
        await supabase.from("expense_splits").delete().eq("expense_id", expenseId);

        // Delete expense
        const { error } = await supabase.from("expenses").delete().eq("id", expenseId);

        if (error) {
            return { success: false, error: error.message };
        }

        // Log activity
        if (expense) {
            await supabase.from("activities").insert({
                user_id: deletedBy,
                group_id: expense.group_id,
                entity_type: "expense",
                entity_id: expenseId,
                action: "deleted",
                metadata: {
                    description: expense.description,
                    amount: expense.amount,
                },
            });
        }

        return { success: true };
    },

    async settleExpenseSplit(
        splitId: string,
        settledBy: string
    ): Promise<{ success: boolean; error?: string }> {
        const supabase = createClient();

        const { error } = await supabase
            .from("expense_splits")
            .update({
                is_settled: true,
                settled_at: new Date().toISOString(),
            })
            .eq("id", splitId);

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true };
    },

    calculateEqualSplits(
        amount: number,
        memberIds: string[]
    ): { user_id: string; amount: number }[] {
        const splitAmount = amount / memberIds.length;
        // Round to 2 decimal places
        const roundedAmount = Math.floor(splitAmount * 100) / 100;
        const remainder = amount - roundedAmount * memberIds.length;

        return memberIds.map((userId, index) => ({
            user_id: userId,
            // Add remainder cents to first person
            amount: index === 0 ? roundedAmount + Math.round(remainder * 100) / 100 : roundedAmount,
        }));
    },

    calculatePercentageSplits(
        amount: number,
        percentages: { user_id: string; percentage: number }[]
    ): { user_id: string; amount: number; percentage: number }[] {
        const totalPercentage = percentages.reduce((sum, p) => sum + p.percentage, 0);
        if (Math.abs(totalPercentage - 100) > 0.01) {
            throw new Error("Percentages must add up to 100");
        }

        return percentages.map((p) => ({
            user_id: p.user_id,
            amount: Math.round((amount * p.percentage) / 100 * 100) / 100,
            percentage: p.percentage,
        }));
    },
};

