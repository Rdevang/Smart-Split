import { expensesService, type CreateExpenseInput } from "@/services/expenses";

describe("expensesService", () => {
    it("validates splits add up to total", async () => {
        const input: CreateExpenseInput = {
            group_id: "g1", paid_by: "u1", description: "Test", amount: 100, category: "food",
            expense_date: "2024-12-12", split_type: "equal", participant_ids: ["u1", "u2"],
            splits: [{ user_id: "u1", amount: 30 }, { user_id: "u2", amount: 30 }],
        };
        const result = await expensesService.createExpense(input);
        expect(result.error).toContain("must equal total amount");
    });

    it("exports service methods", () => {
        expect(typeof expensesService.createExpense).toBe("function");
        expect(typeof expensesService.deleteExpense).toBe("function");
        expect(typeof expensesService.settleExpenseSplit).toBe("function");
        expect(typeof expensesService.getExpenses).toBe("function");
    });
});

