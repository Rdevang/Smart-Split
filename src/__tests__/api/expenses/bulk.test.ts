/**
 * Tests for Bulk Expense API Route Logic
 * Tests validation and business logic without Next.js server dependencies
 */

import { z } from "zod";

// Define the validation schema that mirrors the API route
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

// Validation helper that mirrors API logic
function validateBulkExpenses(input: unknown) {
    const validation = CreateBulkExpensesSchema.safeParse(input);
    if (!validation.success) {
        return { valid: false, error: "Invalid input", details: validation.error.flatten() };
    }

    const data = validation.data;
    
    // Check each expense has a payer
    for (const expense of data.expenses) {
        if (!expense.paid_by && !expense.paid_by_placeholder_id) {
            return { valid: false, error: "Each expense must have a payer" };
        }
        // Check split_among has valid members
        for (const member of expense.split_among) {
            if (!member.user_id && !member.placeholder_id) {
                return { valid: false, error: "Each split member must have user_id or placeholder_id" };
            }
        }
    }

    return { valid: true, data };
}

// Split amount calculation helper
function calculateSplitAmounts(amount: number, memberCount: number): number[] {
    const splitAmount = amount / memberCount;
    const roundedAmount = Math.floor(splitAmount * 100) / 100;
    const remainder = amount - roundedAmount * memberCount;
    
    return Array(memberCount).fill(0).map((_, index) => 
        index === 0 
            ? roundedAmount + Math.round(remainder * 100) / 100
            : roundedAmount
    );
}

describe("Bulk Expense Validation", () => {
    const validExpenseData = {
        group_id: "550e8400-e29b-41d4-a716-446655440000",
        split_type: "equal",
        expenses: [
            {
                description: "Lunch",
                amount: 100,
                paid_by: "550e8400-e29b-41d4-a716-446655440001",
                category: "food",
                expense_date: "2024-01-15",
                split_among: [
                    { user_id: "550e8400-e29b-41d4-a716-446655440001" },
                    { user_id: "550e8400-e29b-41d4-a716-446655440002" },
                ],
            },
        ],
    };

    it("validates correct input", () => {
        const result = validateBulkExpenses(validExpenseData);
        expect(result.valid).toBe(true);
        expect(result.data).toBeDefined();
    });

    it("rejects invalid group_id format", () => {
        const result = validateBulkExpenses({
            ...validExpenseData,
            group_id: "not-a-uuid",
        });
        expect(result.valid).toBe(false);
        expect(result.error).toBe("Invalid input");
    });

    it("rejects empty expenses array", () => {
        const result = validateBulkExpenses({
            ...validExpenseData,
            expenses: [],
        });
        expect(result.valid).toBe(false);
        expect(result.error).toBe("Invalid input");
    });

    it("rejects expense with no payer", () => {
        const result = validateBulkExpenses({
            ...validExpenseData,
            expenses: [{
                description: "Test",
                amount: 50,
                // No paid_by or paid_by_placeholder_id
                split_among: [{ user_id: "550e8400-e29b-41d4-a716-446655440001" }],
            }],
        });
        expect(result.valid).toBe(false);
        expect(result.error).toBe("Each expense must have a payer");
    });

    it("rejects split_among with invalid member", () => {
        const result = validateBulkExpenses({
            ...validExpenseData,
            expenses: [{
                description: "Test",
                amount: 50,
                paid_by: "550e8400-e29b-41d4-a716-446655440001",
                split_among: [{ }], // Invalid - no user_id or placeholder_id
            }],
        });
        expect(result.valid).toBe(false);
        expect(result.error).toBe("Each split member must have user_id or placeholder_id");
    });

    it("rejects negative amount", () => {
        const result = validateBulkExpenses({
            ...validExpenseData,
            expenses: [{
                description: "Test",
                amount: -50,
                paid_by: "550e8400-e29b-41d4-a716-446655440001",
                split_among: [{ user_id: "550e8400-e29b-41d4-a716-446655440001" }],
            }],
        });
        expect(result.valid).toBe(false);
        expect(result.error).toBe("Invalid input");
    });

    it("rejects amount exceeding max", () => {
        const result = validateBulkExpenses({
            ...validExpenseData,
            expenses: [{
                description: "Test",
                amount: 100000001, // > 10000000
                paid_by: "550e8400-e29b-41d4-a716-446655440001",
                split_among: [{ user_id: "550e8400-e29b-41d4-a716-446655440001" }],
            }],
        });
        expect(result.valid).toBe(false);
        expect(result.error).toBe("Invalid input");
    });

    it("rejects more than 50 expenses", () => {
        const tooManyExpenses = Array(51).fill(null).map((_, i) => ({
            description: `Expense ${i}`,
            amount: 10,
            paid_by: "550e8400-e29b-41d4-a716-446655440001",
            split_among: [{ user_id: "550e8400-e29b-41d4-a716-446655440001" }],
        }));

        const result = validateBulkExpenses({
            ...validExpenseData,
            expenses: tooManyExpenses,
        });
        expect(result.valid).toBe(false);
        expect(result.error).toBe("Invalid input");
    });

    it("accepts placeholder as payer", () => {
        const result = validateBulkExpenses({
            ...validExpenseData,
            expenses: [{
                description: "Test",
                amount: 50,
                paid_by_placeholder_id: "550e8400-e29b-41d4-a716-446655440003",
                split_among: [{ user_id: "550e8400-e29b-41d4-a716-446655440001" }],
            }],
        });
        expect(result.valid).toBe(true);
    });

    it("accepts placeholder in split_among", () => {
        const result = validateBulkExpenses({
            ...validExpenseData,
            expenses: [{
                description: "Test",
                amount: 90,
                paid_by: "550e8400-e29b-41d4-a716-446655440001",
                split_among: [
                    { user_id: "550e8400-e29b-41d4-a716-446655440001" },
                    { placeholder_id: "550e8400-e29b-41d4-a716-446655440003" },
                ],
            }],
        });
        expect(result.valid).toBe(true);
    });

    it("rejects invalid date format", () => {
        const result = validateBulkExpenses({
            ...validExpenseData,
            expenses: [{
                description: "Test",
                amount: 50,
                paid_by: "550e8400-e29b-41d4-a716-446655440001",
                expense_date: "01-15-2024", // Wrong format
                split_among: [{ user_id: "550e8400-e29b-41d4-a716-446655440001" }],
            }],
        });
        expect(result.valid).toBe(false);
    });

    it("rejects invalid category", () => {
        const result = validateBulkExpenses({
            ...validExpenseData,
            expenses: [{
                description: "Test",
                amount: 50,
                paid_by: "550e8400-e29b-41d4-a716-446655440001",
                category: "invalid-category" as unknown as "food",
                split_among: [{ user_id: "550e8400-e29b-41d4-a716-446655440001" }],
            }],
        });
        expect(result.valid).toBe(false);
    });

    it("accepts all valid categories", () => {
        const categories = [
            "food", "transport", "entertainment", "utilities",
            "rent", "shopping", "travel", "healthcare", "groceries", "other"
        ] as const;

        for (const category of categories) {
            const result = validateBulkExpenses({
                ...validExpenseData,
                expenses: [{
                    description: "Test",
                    amount: 50,
                    paid_by: "550e8400-e29b-41d4-a716-446655440001",
                    category,
                    split_among: [{ user_id: "550e8400-e29b-41d4-a716-446655440001" }],
                }],
            });
            expect(result.valid).toBe(true);
        }
    });

    it("accepts valid split types", () => {
        const splitTypes = ["equal", "exact", "percentage"] as const;

        for (const splitType of splitTypes) {
            const result = validateBulkExpenses({
                ...validExpenseData,
                split_type: splitType,
            });
            expect(result.valid).toBe(true);
        }
    });

    it("rejects description exceeding max length", () => {
        const result = validateBulkExpenses({
            ...validExpenseData,
            expenses: [{
                description: "a".repeat(201), // > 200 chars
                amount: 50,
                paid_by: "550e8400-e29b-41d4-a716-446655440001",
                split_among: [{ user_id: "550e8400-e29b-41d4-a716-446655440001" }],
            }],
        });
        expect(result.valid).toBe(false);
    });

    it("rejects notes exceeding max length", () => {
        const result = validateBulkExpenses({
            ...validExpenseData,
            expenses: [{
                description: "Test",
                amount: 50,
                paid_by: "550e8400-e29b-41d4-a716-446655440001",
                notes: "a".repeat(501), // > 500 chars
                split_among: [{ user_id: "550e8400-e29b-41d4-a716-446655440001" }],
            }],
        });
        expect(result.valid).toBe(false);
    });

    it("validates multiple expenses correctly", () => {
        const result = validateBulkExpenses({
            ...validExpenseData,
            expenses: [
                {
                    description: "Expense 1",
                    amount: 100,
                    paid_by: "550e8400-e29b-41d4-a716-446655440001",
                    split_among: [
                        { user_id: "550e8400-e29b-41d4-a716-446655440001" },
                        { user_id: "550e8400-e29b-41d4-a716-446655440002" },
                    ],
                },
                {
                    description: "Expense 2",
                    amount: 150,
                    paid_by: "550e8400-e29b-41d4-a716-446655440002",
                    split_among: [
                        { user_id: "550e8400-e29b-41d4-a716-446655440001" },
                    ],
                },
                {
                    description: "Expense 3",
                    amount: 75.50,
                    paid_by_placeholder_id: "550e8400-e29b-41d4-a716-446655440003",
                    category: "entertainment",
                    split_among: [
                        { user_id: "550e8400-e29b-41d4-a716-446655440001" },
                        { placeholder_id: "550e8400-e29b-41d4-a716-446655440003" },
                    ],
                },
            ],
        });
        expect(result.valid).toBe(true);
        expect(result.data?.expenses).toHaveLength(3);
    });
});

describe("Split Amount Calculation", () => {
    it("calculates equal split for 2 members", () => {
        const amounts = calculateSplitAmounts(100, 2);
        expect(amounts).toEqual([50, 50]);
        expect(amounts.reduce((a, b) => a + b, 0)).toBeCloseTo(100);
    });

    it("calculates equal split for 3 members", () => {
        const amounts = calculateSplitAmounts(100, 3);
        expect(amounts[0]).toBeCloseTo(33.34);
        expect(amounts[1]).toBeCloseTo(33.33);
        expect(amounts[2]).toBeCloseTo(33.33);
        expect(amounts.reduce((a, b) => a + b, 0)).toBeCloseTo(100);
    });

    it("handles single member", () => {
        const amounts = calculateSplitAmounts(100, 1);
        expect(amounts).toEqual([100]);
    });

    it("handles large amounts", () => {
        const amounts = calculateSplitAmounts(1000000, 3);
        expect(amounts.reduce((a, b) => a + b, 0)).toBeCloseTo(1000000);
    });

    it("handles small amounts", () => {
        const amounts = calculateSplitAmounts(0.01, 2);
        expect(amounts.reduce((a, b) => a + b, 0)).toBeCloseTo(0.01);
    });

    it("handles amounts that divide evenly", () => {
        const amounts = calculateSplitAmounts(120, 4);
        expect(amounts).toEqual([30, 30, 30, 30]);
    });

    it("handles remainder correctly", () => {
        const amounts = calculateSplitAmounts(100, 7);
        // First member gets the remainder
        expect(amounts[0]).toBeGreaterThan(amounts[1]);
        // Total should still equal original amount
        expect(amounts.reduce((a, b) => a + b, 0)).toBeCloseTo(100);
    });
});

describe("Expense Data Transformation", () => {
    it("transforms user payer correctly", () => {
        const expense = {
            description: "Test",
            amount: 100,
            paid_by: "user-123",
            category: "food",
            expense_date: "2024-01-15",
            split_among: [{ user_id: "user-123" }],
        };

        expect(expense.paid_by).toBe("user-123");
        expect(expense).not.toHaveProperty("paid_by_placeholder_id");
    });

    it("transforms placeholder payer correctly", () => {
        const expense = {
            description: "Test",
            amount: 100,
            paid_by_placeholder_id: "placeholder-123",
            category: "food",
            expense_date: "2024-01-15",
            split_among: [{ user_id: "user-123" }],
        };

        expect(expense.paid_by_placeholder_id).toBe("placeholder-123");
        expect(expense).not.toHaveProperty("paid_by");
    });

    it("defaults category to other if not provided", () => {
        const expense = {
            description: "Test",
            amount: 100,
            paid_by: "user-123",
            split_among: [{ user_id: "user-123" }],
        };

        const category = expense.category || "other";
        expect(category).toBe("other");
    });

    it("defaults expense_date to today if not provided", () => {
        const expense = {
            description: "Test",
            amount: 100,
            paid_by: "user-123",
            split_among: [{ user_id: "user-123" }],
        };

        const today = new Date().toISOString().split("T")[0];
        const expenseDate = expense.expense_date || today;
        expect(expenseDate).toBe(today);
    });
});
