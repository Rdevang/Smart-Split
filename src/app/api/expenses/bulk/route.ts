/**
 * POST /api/expenses/bulk
 * 
 * Create multiple expenses in a single request.
 * Uses distributed locking to prevent duplicate submissions.
 */

import { z } from "zod";
import { createRoute, withAuth, withValidation, ApiResponse, ApiError, type AuthContext, type ValidatedContext } from "@/lib/api";
import { logger } from "@/lib/logger";
import { withLock, LockKeys } from "@/lib/distributed-lock";
import { invalidateGroupCache, invalidateUserCache } from "@/lib/cache";
import { revalidateExpenseTags } from "@/lib/cache-tags";
import { log } from "@/lib/console-logger";

// Validation schema for individual expense with its own split
const BulkExpenseSchema = z.object({
    description: z.string().min(1).max(200),
    amount: z.number().positive().max(10000000),
    paid_by: z.string().uuid().optional(),
    paid_by_placeholder_id: z.string().uuid().optional(),
    category: z.enum([
        "food", "transport", "entertainment", "utilities",
        "rent", "shopping", "travel", "healthcare", "groceries", "other"
    ]).optional(),
    expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    notes: z.string().max(500).optional(),
    split_among: z.array(z.object({
        user_id: z.string().uuid().optional(),
        placeholder_id: z.string().uuid().optional(),
    })).min(1).max(50),
});

const CreateBulkExpensesSchema = z.object({
    group_id: z.string().uuid(),
    split_type: z.enum(["equal", "exact", "percentage"]),
    expenses: z.array(BulkExpenseSchema).min(1).max(50),
});

type BulkExpenseInput = z.infer<typeof CreateBulkExpensesSchema>;
type BulkExpenseContext = AuthContext & ValidatedContext<BulkExpenseInput>;

export const POST = createRoute()
    .use(withAuth())
    .use(withValidation(CreateBulkExpensesSchema))
    .handler(async (ctx) => {
        // Type assertion for accumulated context
        const { user, validated: input, supabase } = ctx as unknown as BulkExpenseContext;

        // Verify user is a member of the group
        const { data: membership } = await supabase
            .from("group_members")
            .select("id")
            .eq("group_id", input.group_id)
            .eq("user_id", user.id)
            .single();

        if (!membership) {
            return ApiError.forbidden("You are not a member of this group");
        }

        // Validate each expense has a payer and valid splits
        for (const expense of input.expenses) {
            if (!expense.paid_by && !expense.paid_by_placeholder_id) {
                return ApiError.badRequest("Each expense must have a payer");
            }
            for (const member of expense.split_among) {
                if (!member.user_id && !member.placeholder_id) {
                    return ApiError.badRequest("Each split member must have user_id or placeholder_id");
                }
            }
        }

        try {
            // Use distributed lock to prevent duplicate bulk submissions
            const result = await withLock(
                LockKeys.bulkExpense(input.group_id, user.id),
                async () => {
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

                    // SINGLE DB HIT: Insert all expenses
                    const { data: createdExpenses, error: expenseError } = await supabase
                        .from("expenses")
                        .insert(expensesToInsert)
                        .select();

                    if (expenseError || !createdExpenses || createdExpenses.length === 0) {
                        logger.warn("Bulk expense insert failed", { error: expenseError?.message });
                        throw new Error(expenseError?.message || "Failed to create expenses");
                    }

                    // Prepare splits for all expenses
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

                    // SINGLE DB HIT: Insert all splits
                    const { error: splitsError } = await supabase
                        .from("expense_splits")
                        .insert(allSplits);

                    if (splitsError) {
                        // Rollback expenses
                        const expenseIds = createdExpenses.map((e) => e.id);
                        await supabase.from("expenses").delete().in("id", expenseIds);
                        throw new Error(splitsError.message);
                    }

                    // Log activities (fire-and-forget)
                    const activities = createdExpenses.map((expense) => ({
                        user_id: user.id,
                        group_id: input.group_id,
                        entity_type: "expense",
                        entity_id: expense.id,
                        action: "created",
                        metadata: {
                            description: expense.description,
                            amount: expense.amount,
                            bulk_created: true,
                        },
                    }));

                    // Fire-and-forget: Activity logging and group timestamp update
                    (async () => {
                        try {
                            await supabase.from("activities").insert(activities);
                        } catch (err) {
                            log.error("BulkExpenses", "Activity logging failed", err);
                        }
                        try {
                            await supabase.from("groups")
                                .update({ updated_at: new Date().toISOString() })
                                .eq("id", input.group_id);
                        } catch (err) {
                            log.error("BulkExpenses", "Group timestamp update failed", err);
                        }
                    })();

                    return createdExpenses;
                },
                { ttl: 15 } // 15 second lock
            );

            // Cache invalidation
            const payerIds = new Set<string>();
            const participantIds = new Set<string>();

            input.expenses.forEach((exp) => {
                if (exp.paid_by) payerIds.add(exp.paid_by);
                exp.split_among.forEach((member) => {
                    if (member.user_id) participantIds.add(member.user_id);
                });
            });

            const allUserIds = [...new Set([...payerIds, ...participantIds])];

            // Redis cache invalidation
            await Promise.all([
                invalidateGroupCache(input.group_id),
                ...allUserIds.map((id) => invalidateUserCache(id)),
            ]);

            // Tag-based invalidation
            for (const payerId of payerIds) {
                revalidateExpenseTags(input.group_id, payerId, [...participantIds]);
            }

            logger.info("Bulk expenses created with cache invalidation", {
                userId: user.id,
                groupId: input.group_id,
                expenseCount: result.length,
                totalAmount: result.reduce((sum, e) => sum + e.amount, 0),
                cacheInvalidated: {
                    groupId: input.group_id,
                    userCount: allUserIds.length,
                },
            });

            return ApiResponse.created({
                success: true,
                expenses: result,
                count: result.length,
            });

        } catch (error) {
            // Handle lock acquisition failure
            if (error instanceof Error && error.message.includes("currently being processed")) {
                return ApiError.rateLimited(5);
            }

            log.error("BulkExpenses", "Request failed", error);
            return ApiError.internal("Failed to create expenses");
        }
    });
