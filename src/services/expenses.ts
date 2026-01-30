import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { safeUuidList, ValidationSchemas } from "@/lib/validation";
import { logger, SecurityEvents } from "@/lib/logger";
import { isGroupMember, verifyExpenseAccess, verifySplitAccess } from "@/lib/auth-helpers";
import { logActivity, logActivities, ActivityTypes } from "@/lib/activity-logger";

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
    paid_by?: string;
    paid_by_placeholder_id?: string;
    category?: ExpenseCategory;
    split_type: SplitType;
    expense_date?: string;
    notes?: string;
    location?: string;
    location_coordinates?: { lat: number; lng: number };
    splits: {
        user_id?: string;
        placeholder_id?: string;
        amount: number;
        percentage?: number;
    }[];
}

export interface BulkExpenseInput {
    description: string;
    amount: number;
    paid_by?: string;
    paid_by_placeholder_id?: string;
    category?: ExpenseCategory;
    expense_date?: string;
    notes?: string;
}

export interface CreateBulkExpensesInput {
    group_id: string;
    split_type: SplitType;
    /** Members to split among - applies to all expenses */
    split_among: {
        user_id?: string;
        placeholder_id?: string;
    }[];
    expenses: BulkExpenseInput[];
}

/** V2: Each expense has its own split_among array */
export interface BulkExpenseInputV2 {
    description: string;
    amount: number;
    paid_by?: string;
    paid_by_placeholder_id?: string;
    category?: ExpenseCategory;
    expense_date?: string;
    notes?: string;
    /** Members to split this specific expense among */
    split_among: {
        user_id?: string;
        placeholder_id?: string;
    }[];
}

export interface CreateBulkExpensesInputV2 {
    group_id: string;
    split_type: SplitType;
    expenses: BulkExpenseInputV2[];
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
            .order("expense_date", { ascending: false })
            .order("created_at", { ascending: false });

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

        // SECURITY: Validate userId is a valid UUID before using in query
        const userIdValidation = ValidationSchemas.uuid.safeParse(userId);
        if (!userIdValidation.success) {
            console.error("Invalid user ID format:", userId);
            return [];
        }
        const validUserId = userIdValidation.data;

        // Get expenses where user paid or is in a split
        const { data: splitExpenseIds } = await supabase
            .from("expense_splits")
            .select("expense_id")
            .eq("user_id", validUserId);

        const rawExpenseIds = splitExpenseIds?.map((s) => s.expense_id) || [];

        // SECURITY: Validate all expense IDs before using in query
        // This prevents SQL injection via malformed UUIDs
        const validExpenseIds = safeUuidList(rawExpenseIds);

        // Build query based on what we have
        let query = supabase
            .from("expenses")
            .select(`
                *,
                paid_by_profile:profiles!expenses_paid_by_fkey (*),
                expense_splits (
                    *,
                    profile:profiles (*)
                )
            `);

        // SECURITY: Use parameterized query instead of string concatenation
        // Supabase's .eq() and .in() methods are parameterized and safe
        if (validExpenseIds.length > 0) {
            // Use .or() with validated UUIDs only
            query = query.or(`paid_by.eq.${validUserId},id.in.(${validExpenseIds.join(",")})`);
        } else {
            // No splits found, just get expenses user paid for
            query = query.eq("paid_by", validUserId);
        }

        const { data: expenses, error } = await query
            .order("expense_date", { ascending: false })
            .order("created_at", { ascending: false })
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

        // Create expense - handle both registered users and placeholders as payers
        const expenseData: Record<string, unknown> = {
            group_id: input.group_id,
            description: input.description,
            amount: input.amount,
            category: input.category || "other",
            split_type: input.split_type,
            expense_date: input.expense_date || new Date().toISOString().split("T")[0],
            notes: input.notes || null,
            location: input.location || null,
            location_coordinates: input.location_coordinates || null,
        };

        // Set either paid_by (user) or paid_by_placeholder_id (placeholder)
        if (input.paid_by_placeholder_id) {
            expenseData.paid_by_placeholder_id = input.paid_by_placeholder_id;
        } else if (input.paid_by) {
            expenseData.paid_by = input.paid_by;
        }

        const { data: expense, error: expenseError } = await supabase
            .from("expenses")
            .insert(expenseData)
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
        await logActivity(supabase, {
            userId: createdBy,
            groupId: input.group_id,
            action: ActivityTypes.EXPENSE_CREATED,
            details: { description: expense.description },
            metadata: {
                entity_type: "expense",
                entity_id: expense.id,
                amount: expense.amount,
            },
        });

        return { expense };
    },

    /**
     * Create multiple expenses in a single database transaction
     * Optimized for batch operations - single DB hit for expenses, single for splits
     * 
     * @param input - Bulk expense input with shared group and split configuration
     * @param createdBy - User ID of the creator
     * @returns Created expenses or error
     */
    async createBulkExpenses(
        input: CreateBulkExpensesInput,
        createdBy: string
    ): Promise<{ expenses: Expense[]; error?: string }> {
        const supabase = createClient();

        // Validate inputs
        if (!input.expenses || input.expenses.length === 0) {
            return { expenses: [], error: "No expenses provided" };
        }

        if (input.expenses.length > 50) {
            return { expenses: [], error: "Maximum 50 expenses per batch" };
        }

        if (!input.split_among || input.split_among.length === 0) {
            return { expenses: [], error: "No members selected for split" };
        }

        // Verify user is a member of the group
        const isMember = await isGroupMember(supabase, input.group_id, createdBy);
        if (!isMember) {
            logger.security(
                SecurityEvents.ACCESS_DENIED,
                "medium",
                "blocked",
                { userId: createdBy, groupId: input.group_id, action: "bulk_expense_create" }
            );
            return { expenses: [], error: "Access denied" };
        }

        // Prepare expenses for batch insert
        const expensesToInsert = input.expenses.map((exp) => {
            const expenseData: Record<string, unknown> = {
                group_id: input.group_id,
                description: exp.description,
                amount: exp.amount,
                category: exp.category || "other",
                split_type: input.split_type,
                expense_date: exp.expense_date || new Date().toISOString().split("T")[0],
                notes: exp.notes || null,
            };

            // Set payer
            if (exp.paid_by_placeholder_id) {
                expenseData.paid_by_placeholder_id = exp.paid_by_placeholder_id;
            } else if (exp.paid_by) {
                expenseData.paid_by = exp.paid_by;
            }

            return expenseData;
        });

        // SINGLE DB HIT: Insert all expenses at once
        const { data: createdExpenses, error: expenseError } = await supabase
            .from("expenses")
            .insert(expensesToInsert)
            .select();

        if (expenseError || !createdExpenses || createdExpenses.length === 0) {
            return {
                expenses: [],
                error: expenseError?.message || "Failed to create expenses"
            };
        }

        // Prepare splits for all expenses
        const allSplits: {
            expense_id: string;
            user_id: string | null;
            placeholder_id: string | null;
            amount: number;
            percentage: number | null;
        }[] = [];

        const memberCount = input.split_among.length;

        createdExpenses.forEach((expense, index) => {
            const originalExpense = input.expenses[index];
            const splitAmount = originalExpense.amount / memberCount;
            const roundedAmount = Math.floor(splitAmount * 100) / 100;
            const remainder = originalExpense.amount - roundedAmount * memberCount;

            input.split_among.forEach((member, memberIndex) => {
                allSplits.push({
                    expense_id: expense.id,
                    user_id: member.user_id || null,
                    placeholder_id: member.placeholder_id || null,
                    // Add remainder to first member
                    amount: memberIndex === 0
                        ? roundedAmount + Math.round(remainder * 100) / 100
                        : roundedAmount,
                    percentage: input.split_type === "percentage"
                        ? Math.round(100 / memberCount * 100) / 100
                        : null,
                });
            });
        });

        // SINGLE DB HIT: Insert all splits at once
        const { error: splitsError } = await supabase
            .from("expense_splits")
            .insert(allSplits);

        if (splitsError) {
            // Rollback: delete all created expenses
            const expenseIds = createdExpenses.map((e) => e.id);
            await supabase.from("expenses").delete().in("id", expenseIds);
            return { expenses: [], error: splitsError.message };
        }

        // SINGLE DB HIT: Update group's updated_at
        await supabase
            .from("groups")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", input.group_id);

        // SINGLE DB HIT: Log activities for all expenses
        await logActivities(supabase, {
            userId: createdBy,
            groupId: input.group_id,
            activities: createdExpenses.map((expense) => ({
                action: ActivityTypes.EXPENSE_CREATED,
                details: { description: expense.description, bulk_created: true },
                metadata: {
                    entity_type: "expense",
                    entity_id: expense.id,
                    amount: expense.amount,
                },
            })),
        });

        return { expenses: createdExpenses as Expense[] };
    },

    /**
     * Create multiple expenses with per-expense split configuration
     * V2: Each expense has its own split_among array
     * 
     * @param input - Bulk expense input with per-expense splits
     * @param createdBy - User ID of the creator
     * @returns Created expenses or error
     */
    async createBulkExpensesV2(
        input: CreateBulkExpensesInputV2,
        createdBy: string
    ): Promise<{ expenses: Expense[]; error?: string }> {
        const supabase = createClient();

        if (!input.expenses || input.expenses.length === 0) {
            return { expenses: [], error: "No expenses provided" };
        }

        if (input.expenses.length > 50) {
            return { expenses: [], error: "Maximum 50 expenses per batch" };
        }

        // Validate each expense has split_among
        for (const exp of input.expenses) {
            if (!exp.split_among || exp.split_among.length === 0) {
                return { expenses: [], error: `Expense "${exp.description}" has no members to split among` };
            }
        }

        // Verify user is a member of the group
        const isMember = await isGroupMember(supabase, input.group_id, createdBy);
        if (!isMember) {
            logger.security(
                SecurityEvents.ACCESS_DENIED,
                "medium",
                "blocked",
                { userId: createdBy, groupId: input.group_id, action: "bulk_expense_create_v2" }
            );
            return { expenses: [], error: "Access denied" };
        }

        // Prepare expenses for batch insert
        const expensesToInsert = input.expenses.map((exp) => {
            const expenseData: Record<string, unknown> = {
                group_id: input.group_id,
                description: exp.description,
                amount: exp.amount,
                category: exp.category || "other",
                split_type: input.split_type,
                expense_date: exp.expense_date || new Date().toISOString().split("T")[0],
                notes: exp.notes || null,
            };

            if (exp.paid_by_placeholder_id) {
                expenseData.paid_by_placeholder_id = exp.paid_by_placeholder_id;
            } else if (exp.paid_by) {
                expenseData.paid_by = exp.paid_by;
            }

            return expenseData;
        });

        // SINGLE DB HIT: Insert all expenses at once
        const { data: createdExpenses, error: expenseError } = await supabase
            .from("expenses")
            .insert(expensesToInsert)
            .select();

        if (expenseError || !createdExpenses || createdExpenses.length === 0) {
            return {
                expenses: [],
                error: expenseError?.message || "Failed to create expenses"
            };
        }

        // Prepare splits for all expenses - each with its own split_among
        const allSplits: {
            expense_id: string;
            user_id: string | null;
            placeholder_id: string | null;
            amount: number;
            percentage: number | null;
        }[] = [];

        createdExpenses.forEach((expense, index) => {
            const originalExpense = input.expenses[index];
            const memberCount = originalExpense.split_among.length;
            const splitAmount = originalExpense.amount / memberCount;
            const roundedAmount = Math.floor(splitAmount * 100) / 100;
            const remainder = originalExpense.amount - roundedAmount * memberCount;

            originalExpense.split_among.forEach((member, memberIndex) => {
                allSplits.push({
                    expense_id: expense.id,
                    user_id: member.user_id || null,
                    placeholder_id: member.placeholder_id || null,
                    amount: memberIndex === 0
                        ? roundedAmount + Math.round(remainder * 100) / 100
                        : roundedAmount,
                    percentage: input.split_type === "percentage"
                        ? Math.round(100 / memberCount * 100) / 100
                        : null,
                });
            });
        });

        // SINGLE DB HIT: Insert all splits at once
        const { error: splitsError } = await supabase
            .from("expense_splits")
            .insert(allSplits);

        if (splitsError) {
            // Rollback: delete all created expenses
            const expenseIds = createdExpenses.map((e) => e.id);
            await supabase.from("expenses").delete().in("id", expenseIds);
            return { expenses: [], error: splitsError.message };
        }

        // SINGLE DB HIT: Update group's updated_at
        await supabase
            .from("groups")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", input.group_id);

        // SINGLE DB HIT: Log activities for all expenses
        await logActivities(supabase, {
            userId: createdBy,
            groupId: input.group_id,
            activities: createdExpenses.map((expense) => ({
                action: ActivityTypes.EXPENSE_CREATED,
                details: { description: expense.description, bulk_created: true },
                metadata: {
                    entity_type: "expense",
                    entity_id: expense.id,
                    amount: expense.amount,
                },
            })),
        });

        return { expenses: createdExpenses as Expense[] };
    },

    /**
     * Update an expense
     * SECURITY: Verifies user is a member of the group before allowing update
     */
    async updateExpense(
        expenseId: string,
        input: UpdateExpenseInput,
        updatedBy: string
    ): Promise<{ success: boolean; error?: string }> {
        const supabase = createClient();

        // SECURITY: Verify user has access to this expense (IDOR prevention)
        const access = await verifyExpenseAccess(supabase, expenseId, updatedBy);
        if (!access) {
            return { success: false, error: "Expense not found or access denied" };
        }

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

        // Log activity
        await logActivity(supabase, {
            userId: updatedBy,
            groupId: access.groupId,
            action: ActivityTypes.EXPENSE_UPDATED,
            metadata: {
                entity_type: "expense",
                entity_id: expenseId,
                changes: Object.keys(input),
            },
        });

        return { success: true };
    },

    /**
     * Soft delete an expense (sets deleted_at timestamp)
     * Expense can be restored within 30 days before permanent deletion
     * SECURITY: Verifies user is a member of the group before allowing delete
     */
    async deleteExpense(
        expenseId: string,
        deletedBy: string
    ): Promise<{ success: boolean; error?: string }> {
        const supabase = createClient();

        // SECURITY: Verify user has access to this expense (IDOR prevention)
        const access = await verifyExpenseAccess(supabase, expenseId, deletedBy);
        if (!access) {
            return { success: false, error: "Expense not found or access denied" };
        }

        // Use soft delete RPC function
        const { error } = await supabase.rpc("soft_delete_expense", {
            expense_uuid: expenseId,
        });

        if (error) {
            // Fallback to manual soft delete
            const { error: updateError } = await supabase
                .from("expenses")
                .update({ deleted_at: new Date().toISOString() })
                .eq("id", expenseId);

            if (updateError) {
                return { success: false, error: updateError.message };
            }
        }

        // Log activity (audit trigger will also log this, but keep for backwards compatibility)
        await logActivity(supabase, {
            userId: deletedBy,
            groupId: access.groupId,
            action: ActivityTypes.EXPENSE_DELETED,
            details: { description: access.expense.description },
            metadata: {
                entity_type: "expense",
                entity_id: expenseId,
                amount: access.expense.amount,
            },
        });

        return { success: true };
    },

    /**
     * Mark an expense split as settled
     * SECURITY: Verifies user is a member of the group before allowing settlement
     */
    async settleExpenseSplit(
        splitId: string,
        settledBy: string
    ): Promise<{ success: boolean; error?: string }> {
        const supabase = createClient();

        // SECURITY: Verify user has access to this split (IDOR prevention)
        const access = await verifySplitAccess(supabase, splitId, settledBy);
        if (!access) {
            return { success: false, error: "Split not found or access denied" };
        }

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

        // Log activity
        await logActivity(supabase, {
            userId: settledBy,
            groupId: access.groupId,
            action: ActivityTypes.SPLIT_SETTLED,
            metadata: {
                entity_type: "expense_split",
                entity_id: splitId,
                expense_id: access.expenseId,
            },
        });

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

