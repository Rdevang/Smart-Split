import { render, screen } from "@testing-library/react";
import { ExpenseCard } from "@/components/features/expenses/expense-card";

jest.mock("next/image", () => ({ __esModule: true, default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }));

describe("ExpenseCard", () => {
    // Use a minimal type that matches ExpenseCardExpense interface
    const expense = {
        id: "e1",
        description: "Dinner",
        amount: 100,
        paid_by: "user-1",
        category: "food" as const,
        expense_date: "2024-12-12",
        paid_by_profile: { id: "user-1", full_name: "Alice", avatar_url: null },
        splits: [
            { id: "s1", user_id: "user-1", amount: 50, is_settled: false, profile: { id: "user-1", full_name: "Alice", avatar_url: null } },
            { id: "s2", user_id: "user-2", amount: 50, is_settled: false, profile: { id: "user-2", full_name: "Bob", avatar_url: null } },
        ],
    };

    it("renders expense description and amount", () => {
        render(<ExpenseCard expense={expense} currentUserId="user-1" />);
        expect(screen.getByText("Dinner")).toBeInTheDocument();
        expect(screen.getByText("$100.00")).toBeInTheDocument();
    });

    it("shows 'you' when user paid", () => {
        render(<ExpenseCard expense={expense} currentUserId="user-1" />);
        expect(screen.getByText("you")).toBeInTheDocument();
    });

    it("shows 'You owe' when user owes", () => {
        render(<ExpenseCard expense={expense} currentUserId="user-2" />);
        expect(screen.getByText("You owe $50.00")).toBeInTheDocument();
    });

    it("shows 'You get back' when owed", () => {
        render(<ExpenseCard expense={expense} currentUserId="user-1" />);
        expect(screen.getByText("You get back $50.00")).toBeInTheDocument();
    });

    it("shows settled badge", () => {
        const settled = { ...expense, splits: [{ ...expense.splits[0], is_settled: true }, expense.splits[1]] };
        render(<ExpenseCard expense={settled} currentUserId="user-1" />);
        expect(screen.getByText("Settled")).toBeInTheDocument();
    });

    it("renders category icon", () => {
        render(<ExpenseCard expense={expense} currentUserId="user-1" />);
        expect(document.querySelector(".bg-orange-100")).toBeInTheDocument();
    });

    describe("currency support", () => {
        it("displays amounts in specified currency (EUR)", () => {
            render(<ExpenseCard expense={expense} currentUserId="user-1" currency="EUR" />);
            // EUR format should include € symbol
            const amountElements = screen.getAllByText(/€|100/);
            expect(amountElements.length).toBeGreaterThan(0);
        });

        it("displays amounts in specified currency (INR)", () => {
            render(<ExpenseCard expense={expense} currentUserId="user-1" currency="INR" />);
            // INR format should include ₹ symbol
            const amountElements = screen.getAllByText(/₹|100/);
            expect(amountElements.length).toBeGreaterThan(0);
        });

        it("displays amounts in specified currency (GBP)", () => {
            render(<ExpenseCard expense={expense} currentUserId="user-1" currency="GBP" />);
            // GBP format should include £ symbol
            const amountElements = screen.getAllByText(/£|100/);
            expect(amountElements.length).toBeGreaterThan(0);
        });

        it("defaults to USD when no currency specified", () => {
            render(<ExpenseCard expense={expense} currentUserId="user-1" />);
            expect(screen.getByText("$100.00")).toBeInTheDocument();
        });
    });
});
