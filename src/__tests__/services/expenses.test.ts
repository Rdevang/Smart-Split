import { expensesService, type CreateExpenseInput } from "@/services/expenses";

// Mock Supabase client
jest.mock("@/lib/supabase/client", () => ({
    createClient: () => ({
        from: () => ({
            select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
            insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: { message: "mock" } }) }) }),
            delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
            update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        }),
    }),
}));

describe("expensesService", () => {
    it("validates splits add up to total", async () => {
        const input: CreateExpenseInput = {
            group_id: "g1",
            paid_by: "u1",
            description: "Test",
            amount: 100,
            category: "food",
            expense_date: "2024-12-12",
            split_type: "equal",
            splits: [
                { user_id: "u1", amount: 30 },
                { user_id: "u2", amount: 30 },
            ],
        };
        const result = await expensesService.createExpense(input, "u1");
        expect(result.error).toContain("must equal total amount");
    });

    it("exports service methods", () => {
        expect(typeof expensesService.createExpense).toBe("function");
        expect(typeof expensesService.deleteExpense).toBe("function");
        expect(typeof expensesService.settleExpenseSplit).toBe("function");
        expect(typeof expensesService.getExpenses).toBe("function");
    });

    it("calculates equal splits correctly", () => {
        const splits = expensesService.calculateEqualSplits(100, ["u1", "u2", "u3"]);
        expect(splits).toHaveLength(3);
        const total = splits.reduce((sum, s) => sum + s.amount, 0);
        expect(total).toBeCloseTo(100, 2);
    });

    it("calculates percentage splits correctly", () => {
        const splits = expensesService.calculatePercentageSplits(100, [
            { user_id: "u1", percentage: 50 },
            { user_id: "u2", percentage: 30 },
            { user_id: "u3", percentage: 20 },
        ]);
        expect(splits[0].amount).toBe(50);
        expect(splits[1].amount).toBe(30);
        expect(splits[2].amount).toBe(20);
    });

    it("throws error for invalid percentages", () => {
        expect(() => {
            expensesService.calculatePercentageSplits(100, [
                { user_id: "u1", percentage: 50 },
                { user_id: "u2", percentage: 30 },
            ]);
        }).toThrow("Percentages must add up to 100");
    });
});
