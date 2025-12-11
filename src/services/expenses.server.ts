import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Expense = Database["public"]["Tables"]["expenses"]["Row"];
type ExpenseSplit = Database["public"]["Tables"]["expense_splits"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export interface ExpenseWithDetails extends Expense {
    paid_by_profile: Profile;
    splits: (ExpenseSplit & { profile: Profile })[];
}

export interface PaginationParams {
    page?: number;
    limit?: number;
}

export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
}

export interface ExpenseSummary {
    totalExpenses: number;
    totalOwed: number;
    totalOwe: number;
    expenseCount: number;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export const expensesServerService = {
    /**
     * Get paginated expenses for a group
     * Optimized: Uses idx_expenses_group_date index
     */
    async getExpenses(
        groupId: string,
        params: PaginationParams = {}
    ): Promise<PaginatedResult<ExpenseWithDetails>> {
        const supabase = await createClient();
        const page = Math.max(1, params.page || 1);
        const limit = Math.min(params.limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
        const offset = (page - 1) * limit;

        const { data: expenses, error, count } = await supabase
            .from("expenses")
            .select(`
                *,
                paid_by_profile:profiles!expenses_paid_by_fkey (
                    id,
                    email,
                    full_name,
                    avatar_url
                ),
                expense_splits (
                    id,
                    user_id,
                    amount,
                    percentage,
                    is_settled,
                    profile:profiles!inner (
                        id,
                        email,
                        full_name,
                        avatar_url
                    )
                )
            `, { count: "exact" })
            .eq("group_id", groupId)
            .order("expense_date", { ascending: false })
            .range(offset, offset + limit - 1);

        if (error || !expenses) {
            console.error("Error fetching expenses:", error);
            return { data: [], total: 0, page, limit, hasMore: false };
        }

        const total = count || 0;
        const data = expenses.map((expense) => ({
            ...expense,
            paid_by_profile: expense.paid_by_profile as Profile,
            splits: (expense.expense_splits || []) as (ExpenseSplit & { profile: Profile })[],
        }));

        return {
            data,
            total,
            page,
            limit,
            hasMore: offset + limit < total,
        };
    },

    /**
     * Get paginated expenses for a user across all groups
     * Optimized: Uses idx_expenses_paid_by and idx_expense_splits_user
     */
    async getUserExpenses(
        userId: string,
        params: PaginationParams = {}
    ): Promise<PaginatedResult<ExpenseWithDetails>> {
        const supabase = await createClient();
        const page = Math.max(1, params.page || 1);
        const limit = Math.min(params.limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
        const offset = (page - 1) * limit;

        // Get expenses where user paid
        const { data: expenses, error, count } = await supabase
            .from("expenses")
            .select(`
                *,
                paid_by_profile:profiles!expenses_paid_by_fkey (
                    id,
                    email,
                    full_name,
                    avatar_url
                ),
                expense_splits (
                    id,
                    user_id,
                    amount,
                    percentage,
                    is_settled,
                    profile:profiles!inner (
                        id,
                        email,
                        full_name,
                        avatar_url
                    )
                )
            `, { count: "exact" })
            .eq("paid_by", userId)
            .order("expense_date", { ascending: false })
            .range(offset, offset + limit - 1);

        if (error || !expenses) {
            console.error("Error fetching user expenses:", error);
            return { data: [], total: 0, page, limit, hasMore: false };
        }

        const total = count || 0;
        const data = expenses.map((expense) => ({
            ...expense,
            paid_by_profile: expense.paid_by_profile as Profile,
            splits: (expense.expense_splits || []) as (ExpenseSplit & { profile: Profile })[],
        }));

        return {
            data,
            total,
            page,
            limit,
            hasMore: offset + limit < total,
        };
    },

    /**
     * Get expense summary for a user (optimized aggregate query)
     * Uses indexed columns for fast aggregation
     */
    async getUserExpenseSummary(userId: string): Promise<ExpenseSummary> {
        const supabase = await createClient();

        // Parallel queries for better performance
        const [paidResult, owedResult, oweResult] = await Promise.all([
            // Total user paid
            supabase
                .from("expenses")
                .select("amount")
                .eq("paid_by", userId),

            // Total others owe user (from expenses user paid)
            supabase
                .from("expense_splits")
                .select(`
                    amount,
                    expense:expenses!inner (
                        paid_by
                    )
                `)
                .eq("is_settled", false)
                .neq("user_id", userId),

            // Total user owes others
            supabase
                .from("expense_splits")
                .select(`
                    amount,
                    expense:expenses!inner (
                        paid_by
                    )
                `)
                .eq("user_id", userId)
                .eq("is_settled", false),
        ]);

        const totalExpenses = (paidResult.data || [])
            .reduce((sum, e) => sum + (e.amount || 0), 0);

        const totalOwed = (owedResult.data || [])
            .filter((s) => {
                const expense = Array.isArray(s.expense) ? s.expense[0] : s.expense;
                return expense?.paid_by === userId;
            })
            .reduce((sum, s) => sum + (s.amount || 0), 0);

        const totalOwe = (oweResult.data || [])
            .filter((s) => {
                const expense = Array.isArray(s.expense) ? s.expense[0] : s.expense;
                return expense?.paid_by !== userId;
            })
            .reduce((sum, s) => sum + (s.amount || 0), 0);

        return {
            totalExpenses,
            totalOwed,
            totalOwe,
            expenseCount: paidResult.data?.length || 0,
        };
    },

    /**
     * Get single expense with details
     */
    async getExpense(expenseId: string): Promise<ExpenseWithDetails | null> {
        const supabase = await createClient();

        const { data: expense, error } = await supabase
            .from("expenses")
            .select(`
                *,
                paid_by_profile:profiles!expenses_paid_by_fkey (
                    id,
                    email,
                    full_name,
                    avatar_url
                ),
                expense_splits (
                    id,
                    user_id,
                    amount,
                    percentage,
                    is_settled,
                    settled_at,
                    profile:profiles!inner (
                        id,
                        email,
                        full_name,
                        avatar_url
                    )
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
            splits: (expense.expense_splits || []) as (ExpenseSplit & { profile: Profile })[],
        };
    },

    /**
     * Get expense count for a group (for stats)
     */
    async getGroupExpenseCount(groupId: string): Promise<number> {
        const supabase = await createClient();

        const { count, error } = await supabase
            .from("expenses")
            .select("*", { count: "exact", head: true })
            .eq("group_id", groupId);

        if (error) {
            console.error("Error counting expenses:", error);
            return 0;
        }

        return count || 0;
    },

    /**
     * Get recent activity for dashboard (limited, no full pagination)
     */
    async getRecentExpenses(
        userId: string,
        limit: number = 5
    ): Promise<ExpenseWithDetails[]> {
        const safeLimit = Math.min(limit, 20); // Cap at 20 for dashboard
        const result = await this.getUserExpenses(userId, { page: 1, limit: safeLimit });
        return result.data;
    },
};
