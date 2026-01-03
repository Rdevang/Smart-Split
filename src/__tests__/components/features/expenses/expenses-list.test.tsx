import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExpensesList } from "@/components/features/expenses/expenses-list";
import { ToastProvider } from "@/components/ui/toast";

// Mock next/navigation
const mockRefresh = jest.fn();
jest.mock("next/navigation", () => ({
    useRouter: () => ({
        refresh: mockRefresh,
        push: jest.fn(),
    }),
}));

// Mock expenses service
const mockUpdateExpense = jest.fn();
const mockDeleteExpense = jest.fn();
jest.mock("@/services/expenses", () => ({
    expensesService: {
        updateExpense: (...args: unknown[]) => mockUpdateExpense(...args),
        deleteExpense: (...args: unknown[]) => mockDeleteExpense(...args),
    },
    UpdateExpenseInput: {},
}));

// Mock next/image
jest.mock("next/image", () => ({
    __esModule: true,
    default: (props: { alt: string; src: string }) => <img alt={props.alt} src={props.src} />,
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <ToastProvider>{children}</ToastProvider>
);

const mockExpenses = [
    {
        id: "expense-1",
        description: "Dinner at Restaurant",
        amount: 100,
        category: "food" as const,
        expense_date: "2024-01-15",
        paid_by: "user-1",
        paid_by_placeholder_id: null,
        paid_by_profile: { id: "user-1", full_name: "John Doe", avatar_url: null },
        paid_by_placeholder: null,
        splits: [
            { id: "split-1", user_id: "user-1", amount: 50, profile: { id: "user-1", full_name: "John Doe", avatar_url: null }, placeholder: null },
            { id: "split-2", user_id: "user-2", amount: 50, profile: { id: "user-2", full_name: "Jane Smith", avatar_url: null }, placeholder: null },
        ],
    },
    {
        id: "expense-2",
        description: "Uber Ride",
        amount: 25,
        category: "transport" as const,
        expense_date: "2024-01-16",
        paid_by: "user-2",
        paid_by_placeholder_id: null,
        paid_by_profile: { id: "user-2", full_name: "Jane Smith", avatar_url: null },
        paid_by_placeholder: null,
        splits: [
            { id: "split-3", user_id: "user-1", amount: 12.5, profile: { id: "user-1", full_name: "John Doe", avatar_url: null }, placeholder: null },
            { id: "split-4", user_id: "user-2", amount: 12.5, profile: { id: "user-2", full_name: "Jane Smith", avatar_url: null }, placeholder: null },
        ],
    },
];

const mockMembers = [
    {
        id: "member-1",
        user_id: "user-1",
        role: "admin",
        profile: { id: "user-1", email: "john@test.com", full_name: "John Doe", avatar_url: null },
        placeholder: null,
    },
    {
        id: "member-2",
        user_id: "user-2",
        role: "member",
        profile: { id: "user-2", email: "jane@test.com", full_name: "Jane Smith", avatar_url: null },
        placeholder: null,
    },
];

describe("ExpensesList", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("renders list of expenses", () => {
        render(
            <ExpensesList
                groupId="group-1"
                expenses={mockExpenses}
                members={mockMembers}
                currentUserId="user-1"
                currency="USD"
            />,
            { wrapper: TestWrapper }
        );

        expect(screen.getByText("Dinner at Restaurant")).toBeInTheDocument();
        expect(screen.getByText("Uber Ride")).toBeInTheDocument();
        expect(screen.getByText("$100.00")).toBeInTheDocument();
        expect(screen.getByText("$25.00")).toBeInTheDocument();
    });

    it("shows empty state when no expenses", () => {
        render(
            <ExpensesList
                groupId="group-1"
                expenses={[]}
                members={mockMembers}
                currentUserId="user-1"
                currency="USD"
            />,
            { wrapper: TestWrapper }
        );

        expect(screen.getByText("No expenses yet")).toBeInTheDocument();
    });

    it("filters expenses by search query", async () => {
        const user = userEvent.setup();
        render(
            <ExpensesList
                groupId="group-1"
                expenses={mockExpenses}
                members={mockMembers}
                currentUserId="user-1"
                currency="USD"
            />,
            { wrapper: TestWrapper }
        );

        const searchInput = screen.getByPlaceholderText("Search expenses...");
        await user.type(searchInput, "Dinner");

        expect(screen.getByText("Dinner at Restaurant")).toBeInTheDocument();
        expect(screen.queryByText("Uber Ride")).not.toBeInTheDocument();
        expect(screen.getByText("Showing 1 of 2 expenses")).toBeInTheDocument();
    });

    it("filters expenses by category", async () => {
        const user = userEvent.setup();
        render(
            <ExpensesList
                groupId="group-1"
                expenses={mockExpenses}
                members={mockMembers}
                currentUserId="user-1"
                currency="USD"
            />,
            { wrapper: TestWrapper }
        );

        const categorySelect = screen.getByDisplayValue("All Categories");
        await user.selectOptions(categorySelect, "transport");

        expect(screen.queryByText("Dinner at Restaurant")).not.toBeInTheDocument();
        expect(screen.getByText("Uber Ride")).toBeInTheDocument();
    });

    it("shows edit/delete buttons only for expenses user paid", () => {
        render(
            <ExpensesList
                groupId="group-1"
                expenses={mockExpenses}
                members={mockMembers}
                currentUserId="user-1"
                currency="USD"
            />,
            { wrapper: TestWrapper }
        );

        // User paid for "Dinner" - should have edit button
        const editButtons = screen.getAllByTitle("Edit expense");
        expect(editButtons).toHaveLength(1);

        const deleteButtons = screen.getAllByTitle("Delete expense");
        expect(deleteButtons).toHaveLength(1);
    });

    it("shows edit/delete buttons for all expenses when user is admin", () => {
        render(
            <ExpensesList
                groupId="group-1"
                expenses={mockExpenses}
                members={mockMembers}
                currentUserId="user-1"
                currency="USD"
                isAdmin={true}
            />,
            { wrapper: TestWrapper }
        );

        // Admin should see edit buttons for all expenses
        const editButtons = screen.getAllByTitle("Edit expense");
        expect(editButtons).toHaveLength(2);

        const deleteButtons = screen.getAllByTitle("Delete expense");
        expect(deleteButtons).toHaveLength(2);
    });

    it("opens edit form when edit button clicked", async () => {
        const user = userEvent.setup();
        render(
            <ExpensesList
                groupId="group-1"
                expenses={mockExpenses}
                members={mockMembers}
                currentUserId="user-1"
                currency="USD"
            />,
            { wrapper: TestWrapper }
        );

        const editButton = screen.getByTitle("Edit expense");
        await user.click(editButton);

        // Edit form should be visible
        expect(screen.getByDisplayValue("Dinner at Restaurant")).toBeInTheDocument();
        expect(screen.getByDisplayValue("100")).toBeInTheDocument();
        expect(screen.getByText("Save Changes")).toBeInTheDocument();
        expect(screen.getByText("Cancel")).toBeInTheDocument();
    });

    it("cancels edit when cancel button clicked", async () => {
        const user = userEvent.setup();
        render(
            <ExpensesList
                groupId="group-1"
                expenses={mockExpenses}
                members={mockMembers}
                currentUserId="user-1"
                currency="USD"
            />,
            { wrapper: TestWrapper }
        );

        const editButton = screen.getByTitle("Edit expense");
        await user.click(editButton);

        const cancelButton = screen.getByText("Cancel");
        await user.click(cancelButton);

        // Edit form should be hidden
        expect(screen.queryByText("Save Changes")).not.toBeInTheDocument();
    });

    it("saves expense when save button clicked", async () => {
        mockUpdateExpense.mockResolvedValue({ success: true });
        const user = userEvent.setup();

        render(
            <ExpensesList
                groupId="group-1"
                expenses={mockExpenses}
                members={mockMembers}
                currentUserId="user-1"
                currency="USD"
            />,
            { wrapper: TestWrapper }
        );

        const editButton = screen.getByTitle("Edit expense");
        await user.click(editButton);

        // Change description
        const descriptionInput = screen.getByDisplayValue("Dinner at Restaurant");
        await user.clear(descriptionInput);
        await user.type(descriptionInput, "Updated Dinner");

        const saveButton = screen.getByText("Save Changes");
        await user.click(saveButton);

        await waitFor(() => {
            expect(mockUpdateExpense).toHaveBeenCalledWith(
                "expense-1",
                { description: "Updated Dinner" },
                "user-1"
            );
        });

        expect(mockRefresh).toHaveBeenCalled();
    });

    it("shows delete confirmation modal", async () => {
        const user = userEvent.setup();
        render(
            <ExpensesList
                groupId="group-1"
                expenses={mockExpenses}
                members={mockMembers}
                currentUserId="user-1"
                currency="USD"
            />,
            { wrapper: TestWrapper }
        );

        const deleteButton = screen.getByTitle("Delete expense");
        await user.click(deleteButton);

        expect(screen.getByText("Delete Expense?")).toBeInTheDocument();
        expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();
        expect(screen.getByText("Delete Expense")).toBeInTheDocument();
    });

    it("deletes expense when confirmed", async () => {
        mockDeleteExpense.mockResolvedValue({ success: true });
        const user = userEvent.setup();

        render(
            <ExpensesList
                groupId="group-1"
                expenses={mockExpenses}
                members={mockMembers}
                currentUserId="user-1"
                currency="USD"
            />,
            { wrapper: TestWrapper }
        );

        const deleteButton = screen.getByTitle("Delete expense");
        await user.click(deleteButton);

        const confirmButton = screen.getByText("Delete Expense");
        await user.click(confirmButton);

        await waitFor(() => {
            expect(mockDeleteExpense).toHaveBeenCalledWith("expense-1", "user-1");
        });

        expect(mockRefresh).toHaveBeenCalled();
    });

    it("closes delete modal when cancelled", async () => {
        const user = userEvent.setup();
        render(
            <ExpensesList
                groupId="group-1"
                expenses={mockExpenses}
                members={mockMembers}
                currentUserId="user-1"
                currency="USD"
            />,
            { wrapper: TestWrapper }
        );

        const deleteButton = screen.getByTitle("Delete expense");
        await user.click(deleteButton);

        // Find the Cancel button in the modal (not the edit form cancel)
        const cancelButtons = screen.getAllByText("Cancel");
        await user.click(cancelButtons[0]);

        expect(screen.queryByText("Delete Expense?")).not.toBeInTheDocument();
    });

    it("shows user owe amount for expenses paid by others", () => {
        render(
            <ExpensesList
                groupId="group-1"
                expenses={mockExpenses}
                members={mockMembers}
                currentUserId="user-1"
                currency="USD"
            />,
            { wrapper: TestWrapper }
        );

        // For Uber Ride paid by user-2, user-1 owes $12.50
        expect(screen.getByText("You owe $12.50")).toBeInTheDocument();
    });

    it("shows get back amount for expenses user paid", () => {
        render(
            <ExpensesList
                groupId="group-1"
                expenses={mockExpenses}
                members={mockMembers}
                currentUserId="user-1"
                currency="USD"
            />,
            { wrapper: TestWrapper }
        );

        // For Dinner paid by user-1, they get back $50 from others
        expect(screen.getByText("You get back $50.00")).toBeInTheDocument();
    });

    it("clears filters when clear button clicked", async () => {
        const user = userEvent.setup();
        render(
            <ExpensesList
                groupId="group-1"
                expenses={mockExpenses}
                members={mockMembers}
                currentUserId="user-1"
                currency="USD"
            />,
            { wrapper: TestWrapper }
        );

        // Search for something that doesn't exist
        const searchInput = screen.getByPlaceholderText("Search expenses...");
        await user.type(searchInput, "nonexistent");

        expect(screen.getByText("No expenses match your search")).toBeInTheDocument();

        const clearButton = screen.getByText("Clear filters");
        await user.click(clearButton);

        expect(screen.getByText("Dinner at Restaurant")).toBeInTheDocument();
        expect(screen.getByText("Uber Ride")).toBeInTheDocument();
    });

    it("handles update error gracefully", async () => {
        mockUpdateExpense.mockResolvedValue({ success: false, error: "Update failed" });
        const user = userEvent.setup();

        render(
            <ExpensesList
                groupId="group-1"
                expenses={mockExpenses}
                members={mockMembers}
                currentUserId="user-1"
                currency="USD"
            />,
            { wrapper: TestWrapper }
        );

        const editButton = screen.getByTitle("Edit expense");
        await user.click(editButton);

        const descriptionInput = screen.getByDisplayValue("Dinner at Restaurant");
        await user.clear(descriptionInput);
        await user.type(descriptionInput, "Updated");

        const saveButton = screen.getByText("Save Changes");
        await user.click(saveButton);

        await waitFor(() => {
            expect(mockUpdateExpense).toHaveBeenCalled();
        });
    });

    it("handles delete error gracefully", async () => {
        mockDeleteExpense.mockResolvedValue({ success: false, error: "Delete failed" });
        const user = userEvent.setup();

        render(
            <ExpensesList
                groupId="group-1"
                expenses={mockExpenses}
                members={mockMembers}
                currentUserId="user-1"
                currency="USD"
            />,
            { wrapper: TestWrapper }
        );

        const deleteButton = screen.getByTitle("Delete expense");
        await user.click(deleteButton);

        const confirmButton = screen.getByText("Delete Expense");
        await user.click(confirmButton);

        await waitFor(() => {
            expect(mockDeleteExpense).toHaveBeenCalled();
        });
    });
});

