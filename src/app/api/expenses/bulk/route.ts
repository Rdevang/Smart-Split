import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { withLock, LockKeys } from "@/lib/distributed-lock";
import { invalidateGroupCache, invalidateUserCache } from "@/lib/cache";
import { revalidateExpenseTags } from "@/lib/cache-tags";

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

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Auth check
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Parse and validate
        const body = await request.json();
        const validation = CreateBulkExpensesSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: "Invalid input", details: validation.error.flatten() },
                { status: 400 }
            );
        }

        const input = validation.data;

        // Validate each expense has a payer and valid splits
        for (const expense of input.expenses) {
            if (!expense.paid_by && !expense.paid_by_placeholder_id) {
                return NextResponse.json(
                    { error: "Each expense must have a payer" },
                    { status: 400 }
                );
            }
            for (const member of expense.split_among) {
                if (!member.user_id && !member.placeholder_id) {
                    return NextResponse.json(
                        { error: "Each split member must have user_id or placeholder_id" },
                        { status: 400 }
                    );
                }
            }
        }

        // Check user is a member of the group (server-side)
        const { data: membership } = await supabase
            .from("group_members")
            .select("id")
            .eq("group_id", input.group_id)
            .eq("user_id", user.id)
            .single();

        if (!membership) {
            return NextResponse.json({ error: "You are not a member of this group" }, { status: 403 });
        }

        // Use distributed lock to prevent duplicate bulk submissions
        // This prevents race conditions if user double-clicks submit
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

                // Update group's updated_at
                await supabase
                    .from("groups")
                    .update({ updated_at: new Date().toISOString() })
                    .eq("id", input.group_id);

                // Log activities
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

                await supabase.from("activities").insert(activities);

                return createdExpenses;
            },
            { ttl: 15 } // 15 second lock - bulk operations may take longer
        );

        // ============================================
        // CACHE INVALIDATION (after successful creation)
        // ============================================
        // Extract all unique user IDs for cache invalidation
        const payerIds = new Set<string>();
        const participantIds = new Set<string>();

        input.expenses.forEach((exp) => {
            // Collect payer IDs (only real users, not placeholders)
            if (exp.paid_by) {
                payerIds.add(exp.paid_by);
            }
            // Collect participant IDs
            exp.split_among.forEach((member) => {
                if (member.user_id) {
                    participantIds.add(member.user_id);
                }
            });
        });

        const allUserIds = [...new Set([...payerIds, ...participantIds])];

        // 1. Redis cache invalidation (batched for efficiency)
        await Promise.all([
            invalidateGroupCache(input.group_id),
            ...allUserIds.map((id) => invalidateUserCache(id)),
        ]);

        // 2. Tag-based invalidation for each payer
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

        return NextResponse.json({
            success: true,
            expenses: result,
            count: result.length,
        });

    } catch (error) {
        // Handle lock acquisition failure (user should retry)
        if (error instanceof Error && error.message.includes("currently being processed")) {
            return NextResponse.json(
                { error: "Request already in progress. Please wait." },
                { status: 429 }
            );
        }

        // All other errors are internal/database errors - return 500
        // Validation errors are already handled earlier with explicit 400 responses
        console.error("[Bulk Expenses] Error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
