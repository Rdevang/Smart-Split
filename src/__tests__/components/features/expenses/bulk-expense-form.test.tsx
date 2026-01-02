import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BulkExpenseForm } from "@/components/features/expenses/bulk-expense-form";
import { ToastProvider } from "@/components/ui/toast";

// Mock next/navigation
const mockPush = jest.fn();
const mockRefresh = jest.fn();
const mockBack = jest.fn();
jest.mock("next/navigation", () => ({
    useRouter: () => ({
        push: mockPush,
        refresh: mockRefresh,
        back: mockBack,
    }),
}));

// Mock server actions
jest.mock("@/app/(dashboard)/actions", () => ({
    onExpenseMutation: jest.fn().mockResolvedValue(undefined),
    getEncryptedGroupUrl: jest.fn().mockResolvedValue("/groups/encrypted-id"),
}));

// Mock fetch
global.fetch = jest.fn();

const mockGroup = {
    id: "group-123",
    name: "Test Trip",
    members: [
        {
            id: "member-1",
            user_id: "user-1",
            role: "admin",
            is_placeholder: false,
            profile: {
                id: "user-1",
                email: "test@example.com",
                full_name: "Test User",
                avatar_url: null,
            },
            placeholder: null,
        },
        {
            id: "member-2",
            user_id: "user-2",
            role: "member",
            is_placeholder: false,
            profile: {
                id: "user-2",
                email: "john@example.com",
                full_name: "John Doe",
                avatar_url: null,
            },
            placeholder: null,
        },
        {
            id: "member-3",
            user_id: null,
            role: "member",
            is_placeholder: true,
            profile: null,
            placeholder: {
                id: "placeholder-1",
                name: "Jane (not signed up)",
                email: null,
            },
        },
    ],
};

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <ToastProvider>{children}</ToastProvider>
);

describe("BulkExpenseForm", () => {
    const user = userEvent.setup({ delay: null });

    beforeEach(() => {
        jest.clearAllMocks();
        (global.fetch as jest.Mock).mockReset();
    });

    it("renders the form with initial state", () => {
        render(
            <BulkExpenseForm group={mockGroup} userId="user-1" />,
            { wrapper: TestWrapper }
        );

        expect(screen.getByText("Add Multiple Expenses")).toBeInTheDocument();
        expect(screen.getByText(/Test Trip/)).toBeInTheDocument();
        expect(screen.getByText("Expenses (1)")).toBeInTheDocument();
        // Total appears in multiple places, use getAllByText
        expect(screen.getAllByText(/₹0\.00/).length).toBeGreaterThanOrEqual(1);
    });

    it("shows all members selected by default for split", () => {
        render(
            <BulkExpenseForm group={mockGroup} userId="user-1" />,
            { wrapper: TestWrapper }
        );

        // Click to expand split section
        const splitButton = screen.getByText(/Split among 3 of 3 members/);
        expect(splitButton).toBeInTheDocument();
    });

    it("adds a new expense row when Add Row is clicked", async () => {
        render(
            <BulkExpenseForm group={mockGroup} userId="user-1" />,
            { wrapper: TestWrapper }
        );

        expect(screen.getByText("Expenses (1)")).toBeInTheDocument();

        const addButton = screen.getByRole("button", { name: /Add Row/i });
        await user.click(addButton);

        expect(screen.getByText("Expenses (2)")).toBeInTheDocument();
    });

    it("removes expense row when delete is clicked", async () => {
        render(
            <BulkExpenseForm group={mockGroup} userId="user-1" />,
            { wrapper: TestWrapper }
        );

        // Add a second row first
        const addButton = screen.getByRole("button", { name: /Add Row/i });
        await user.click(addButton);
        expect(screen.getByText("Expenses (2)")).toBeInTheDocument();

        // Delete buttons - get all and click the first one
        const deleteButtons = screen.getAllByRole("button").filter(
            btn => btn.querySelector('svg.lucide-trash-2')
        );
        await user.click(deleteButtons[0]);

        expect(screen.getByText("Expenses (1)")).toBeInTheDocument();
    });

    it("cannot delete the last expense row", async () => {
        render(
            <BulkExpenseForm group={mockGroup} userId="user-1" />,
            { wrapper: TestWrapper }
        );

        // Find the delete button and check it's disabled
        const deleteButtons = screen.getAllByRole("button").filter(
            btn => btn.querySelector('svg.lucide-trash-2')
        );
        expect(deleteButtons[0]).toBeDisabled();
    });

    it("updates total when amount is entered", async () => {
        render(
            <BulkExpenseForm group={mockGroup} userId="user-1" />,
            { wrapper: TestWrapper }
        );

        const amountInput = screen.getByPlaceholderText("0.00");
        await user.clear(amountInput);
        await user.type(amountInput, "150.50");

        // Total appears in multiple places
        expect(screen.getAllByText(/₹150\.50/).length).toBeGreaterThanOrEqual(1);
    });

    it("shows validation errors for empty required fields", async () => {
        render(
            <BulkExpenseForm group={mockGroup} userId="user-1" />,
            { wrapper: TestWrapper }
        );

        const submitButton = screen.getByRole("button", { name: /Create All/i });
        await user.click(submitButton);

        // Should show error toast (validation failed)
        await waitFor(() => {
            expect(screen.getByText(/Please fix the errors/i)).toBeInTheDocument();
        });
    });

    it("submits expenses successfully", async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ 
                success: true, 
                count: 1,
                expenses: [{ id: "exp-1", description: "Lunch", amount: 100 }]
            }),
        });

        render(
            <BulkExpenseForm group={mockGroup} userId="user-1" />,
            { wrapper: TestWrapper }
        );

        // Fill in expense details
        const descriptionInput = screen.getByPlaceholderText("Expense 1");
        await user.type(descriptionInput, "Lunch");

        const amountInput = screen.getByPlaceholderText("0.00");
        await user.type(amountInput, "100");

        // Select payer
        const paidBySelect = screen.getAllByRole("combobox")[0];
        await user.selectOptions(paidBySelect, "user-1");

        // Submit
        const submitButton = screen.getByRole("button", { name: /Create All/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                "/api/expenses/bulk",
                expect.objectContaining({
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                })
            );
        });
    });

    it("handles API error gracefully", async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            json: () => Promise.resolve({ error: "Server error" }),
        });

        render(
            <BulkExpenseForm group={mockGroup} userId="user-1" />,
            { wrapper: TestWrapper }
        );

        // Fill in minimum required fields
        const descriptionInput = screen.getByPlaceholderText("Expense 1");
        await user.type(descriptionInput, "Test");

        const amountInput = screen.getByPlaceholderText("0.00");
        await user.type(amountInput, "50");

        const paidBySelect = screen.getAllByRole("combobox")[0];
        await user.selectOptions(paidBySelect, "user-1");

        const submitButton = screen.getByRole("button", { name: /Create All/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText(/Server error/i)).toBeInTheDocument();
        });
    });

    it("toggles member selection in split among", async () => {
        render(
            <BulkExpenseForm group={mockGroup} userId="user-1" />,
            { wrapper: TestWrapper }
        );

        // Expand split section
        const splitButton = screen.getByText(/Split among 3 of 3 members/);
        await user.click(splitButton);

        // Should see all members - use getAllByText for elements that appear multiple times
        expect(screen.getAllByText("You").length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText("John Doe").length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText("Jane (not signed up)").length).toBeGreaterThanOrEqual(1);

        // Click to deselect "John Doe" - find the button in the split section
        const johnButtons = screen.getAllByText("John Doe");
        const johnMemberButton = johnButtons.find(el => 
            el.closest("button")?.classList.contains("rounded-full")
        )?.closest("button");
        
        if (johnMemberButton) {
            await user.click(johnMemberButton);
        }

        // Should now show 2 of 3
        expect(screen.getByText(/Split among 2 of 3 members/)).toBeInTheDocument();
    });

    it("shows select all and clear all buttons", async () => {
        render(
            <BulkExpenseForm group={mockGroup} userId="user-1" />,
            { wrapper: TestWrapper }
        );

        // Expand split section
        const splitButton = screen.getByText(/Split among 3 of 3 members/);
        await user.click(splitButton);

        expect(screen.getByText("Select all")).toBeInTheDocument();
        expect(screen.getByText("Clear all")).toBeInTheDocument();
    });

    it("clears all members when Clear all is clicked", async () => {
        render(
            <BulkExpenseForm group={mockGroup} userId="user-1" />,
            { wrapper: TestWrapper }
        );

        // Expand split section
        const splitButton = screen.getByText(/Split among 3 of 3 members/);
        await user.click(splitButton);

        // Click Clear all
        const clearAllButton = screen.getByText("Clear all");
        await user.click(clearAllButton);

        // Should now show 0 of 3
        expect(screen.getByText(/Split among 0 of 3 members/)).toBeInTheDocument();
    });

    it("navigates back when Cancel is clicked", async () => {
        render(
            <BulkExpenseForm group={mockGroup} userId="user-1" />,
            { wrapper: TestWrapper }
        );

        const cancelButton = screen.getByRole("button", { name: /Cancel/i });
        await user.click(cancelButton);

        expect(mockBack).toHaveBeenCalled();
    });

    it("displays correct expense count in footer", async () => {
        render(
            <BulkExpenseForm group={mockGroup} userId="user-1" />,
            { wrapper: TestWrapper }
        );

        expect(screen.getByText(/1 expense/)).toBeInTheDocument();

        // Add more rows
        const addButton = screen.getByRole("button", { name: /Add Row/i });
        await user.click(addButton);
        await user.click(addButton);

        expect(screen.getByText(/3 expenses/)).toBeInTheDocument();
    });
});
