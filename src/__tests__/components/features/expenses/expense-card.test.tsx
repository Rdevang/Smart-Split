import { render, screen } from "@testing-library/react";
import { ExpenseCard } from "@/components/features/expenses/expense-card";
import type { ExpenseWithDetails } from "@/services/expenses";

jest.mock("next/image", () => ({ __esModule: true, default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }));

describe("ExpenseCard", () => {
    const expense: ExpenseWithDetails = {
        id: "e1", group_id: "g1", description: "Dinner", amount: 100, paid_by: "user-1", category: "food",
        expense_date: "2024-12-12", split_type: "equal", created_at: "2024-12-12T10:00:00Z", updated_at: "2024-12-12T10:00:00Z",
        paid_by_profile: { id: "user-1", full_name: "Alice", avatar_url: null },
        splits: [
            { id: "s1", expense_id: "e1", user_id: "user-1", amount: 50, percentage: null, is_settled: false, settled_at: null, created_at: "2024-12-12T10:00:00Z", profile: { id: "user-1", full_name: "Alice", avatar_url: null } },
            { id: "s2", expense_id: "e1", user_id: "user-2", amount: 50, percentage: null, is_settled: false, settled_at: null, created_at: "2024-12-12T10:00:00Z", profile: { id: "user-2", full_name: "Bob", avatar_url: null } },
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
});

