import { simplifyDebts, getSimplificationStats, formatPayment, type Balance } from "@/lib/simplify-debts";

describe("simplifyDebts", () => {
    it("returns empty array when all balances are zero", () => {
        const balances: Balance[] = [
            { user_id: "1", user_name: "Alice", balance: 0 },
            { user_id: "2", user_name: "Bob", balance: 0 },
        ];

        const result = simplifyDebts(balances);
        expect(result).toEqual([]);
    });

    it("returns empty array when balances are already settled", () => {
        const balances: Balance[] = [];
        const result = simplifyDebts(balances);
        expect(result).toEqual([]);
    });

    it("handles simple two-person debt", () => {
        const balances: Balance[] = [
            { user_id: "1", user_name: "Alice", balance: 50 },  // Owed $50
            { user_id: "2", user_name: "Bob", balance: -50 },   // Owes $50
        ];

        const result = simplifyDebts(balances);
        
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            from_user_id: "2",
            from_user_name: "Bob",
            to_user_id: "1",
            to_user_name: "Alice",
            amount: 50,
            from_is_placeholder: undefined,
            to_is_placeholder: undefined,
        });
    });

    it("handles three-person chain debt", () => {
        // Alice paid $30 for everyone, Bob paid nothing, Charlie paid nothing
        // Each person's share: $10
        // Alice is owed $20 (paid $30, share $10)
        // Bob owes $10
        // Charlie owes $10
        const balances: Balance[] = [
            { user_id: "1", user_name: "Alice", balance: 20 },
            { user_id: "2", user_name: "Bob", balance: -10 },
            { user_id: "3", user_name: "Charlie", balance: -10 },
        ];

        const result = simplifyDebts(balances);

        expect(result).toHaveLength(2);
        
        // Bob and Charlie both pay Alice
        const totalToAlice = result
            .filter(p => p.to_user_id === "1")
            .reduce((sum, p) => sum + p.amount, 0);
        
        expect(totalToAlice).toBe(20);
    });

    it("minimizes number of transactions", () => {
        // Complex scenario:
        // Alice: +30 (owed $30)
        // Bob: +20 (owed $20)
        // Charlie: -25 (owes $25)
        // Dave: -25 (owes $25)
        const balances: Balance[] = [
            { user_id: "1", user_name: "Alice", balance: 30 },
            { user_id: "2", user_name: "Bob", balance: 20 },
            { user_id: "3", user_name: "Charlie", balance: -25 },
            { user_id: "4", user_name: "Dave", balance: -25 },
        ];

        const result = simplifyDebts(balances);

        // Should minimize to 3 transactions instead of potential 4
        // Possible optimal: Charlie->Alice(25), Dave->Alice(5), Dave->Bob(20)
        expect(result.length).toBeLessThanOrEqual(3);

        // Verify total amounts balance out
        const totalPaid = result.reduce((sum, p) => sum + p.amount, 0);
        expect(totalPaid).toBe(50); // Total debt is $50
    });

    it("handles floating point precision", () => {
        const balances: Balance[] = [
            { user_id: "1", user_name: "Alice", balance: 33.33 },
            { user_id: "2", user_name: "Bob", balance: -16.665 },
            { user_id: "3", user_name: "Charlie", balance: -16.665 },
        ];

        const result = simplifyDebts(balances);

        // Should handle rounding gracefully
        expect(result.length).toBeGreaterThan(0);
        
        // All amounts should be rounded to 2 decimal places
        result.forEach(payment => {
            const rounded = Math.round(payment.amount * 100) / 100;
            expect(payment.amount).toBe(rounded);
        });
    });

    it("handles placeholder members", () => {
        const balances: Balance[] = [
            { user_id: "1", user_name: "Alice", balance: 50, is_placeholder: false },
            { user_id: "ph-1", user_name: "Mom", balance: -50, is_placeholder: true },
        ];

        const result = simplifyDebts(balances);

        expect(result).toHaveLength(1);
        expect(result[0].from_is_placeholder).toBe(true);
        expect(result[0].to_is_placeholder).toBe(false);
    });

    it("ignores very small balances (< $0.01)", () => {
        const balances: Balance[] = [
            { user_id: "1", user_name: "Alice", balance: 0.005 },
            { user_id: "2", user_name: "Bob", balance: -0.005 },
        ];

        const result = simplifyDebts(balances);
        expect(result).toEqual([]);
    });

    it("handles single debtor multiple creditors", () => {
        const balances: Balance[] = [
            { user_id: "1", user_name: "Alice", balance: 30 },
            { user_id: "2", user_name: "Bob", balance: 20 },
            { user_id: "3", user_name: "Charlie", balance: -50 },
        ];

        const result = simplifyDebts(balances);

        // Charlie pays both Alice and Bob
        expect(result.length).toBe(2);
        
        const charliePayments = result.filter(p => p.from_user_id === "3");
        expect(charliePayments).toHaveLength(2);
        
        const totalFromCharlie = charliePayments.reduce((sum, p) => sum + p.amount, 0);
        expect(totalFromCharlie).toBe(50);
    });

    it("handles single creditor multiple debtors", () => {
        const balances: Balance[] = [
            { user_id: "1", user_name: "Alice", balance: 50 },
            { user_id: "2", user_name: "Bob", balance: -30 },
            { user_id: "3", user_name: "Charlie", balance: -20 },
        ];

        const result = simplifyDebts(balances);

        // Bob and Charlie both pay Alice
        expect(result.length).toBe(2);
        
        const paymentsToAlice = result.filter(p => p.to_user_id === "1");
        expect(paymentsToAlice).toHaveLength(2);
        
        const totalToAlice = paymentsToAlice.reduce((sum, p) => sum + p.amount, 0);
        expect(totalToAlice).toBe(50);
    });
});

describe("getSimplificationStats", () => {
    it("calculates correct stats for simple case", () => {
        const balances: Balance[] = [
            { user_id: "1", user_name: "Alice", balance: 50 },
            { user_id: "2", user_name: "Bob", balance: -50 },
        ];

        const stats = getSimplificationStats(balances);

        expect(stats.simplifiedPayments).toBe(1);
        expect(stats.savings).toBeGreaterThanOrEqual(0);
    });

    it("returns zeros for empty balances", () => {
        const stats = getSimplificationStats([]);

        expect(stats.originalPayments).toBe(0);
        expect(stats.simplifiedPayments).toBe(0);
        expect(stats.savings).toBe(0);
    });
});

describe("formatPayment", () => {
    it("formats payment with default currency", () => {
        const payment = {
            from_user_id: "1",
            from_user_name: "Bob",
            to_user_id: "2",
            to_user_name: "Alice",
            amount: 50.00,
        };

        const result = formatPayment(payment);
        expect(result).toBe("Bob pays Alice $50.00");
    });

    it("formats payment with custom currency", () => {
        const payment = {
            from_user_id: "1",
            from_user_name: "Bob",
            to_user_id: "2",
            to_user_name: "Alice",
            amount: 50.00,
        };

        const result = formatPayment(payment, "EUR");
        expect(result).toContain("Bob pays Alice");
        expect(result).toContain("50");
    });

    it("handles decimal amounts", () => {
        const payment = {
            from_user_id: "1",
            from_user_name: "Bob",
            to_user_id: "2",
            to_user_name: "Alice",
            amount: 33.33,
        };

        const result = formatPayment(payment);
        expect(result).toBe("Bob pays Alice $33.33");
    });
});

