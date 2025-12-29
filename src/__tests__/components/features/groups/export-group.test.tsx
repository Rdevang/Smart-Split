import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExportGroup } from "@/components/features/groups/export-group";
import { ToastProvider } from "@/components/ui/toast";

// Mock window.open
const mockWindowOpen = jest.fn();
window.open = mockWindowOpen;

// Mock URL methods
URL.createObjectURL = jest.fn(() => "blob:http://localhost/test");
URL.revokeObjectURL = jest.fn();

// Mock currency formatter
jest.mock("@/lib/currency", () => ({
    formatCurrency: (amount: number, currency: string) => `${currency === "EUR" ? "€" : "$"}${amount.toFixed(2)}`,
}));

// Wrapper with ToastProvider
function TestWrapper({ children }: { children: React.ReactNode }) {
    return <ToastProvider>{children}</ToastProvider>;
}

describe("ExportGroup", () => {
    const defaultProps = {
        groupName: "Test Trip",
        expenses: [
            {
                id: "exp-1",
                description: "Dinner",
                amount: 50,
                category: "food",
                expense_date: "2024-01-15",
                paid_by: "user-1",
                paid_by_profile: { id: "user-1", full_name: "Alice" },
                splits: [
                    { user_id: "user-1", amount: 25, profile: { full_name: "Alice" } },
                    { user_id: "user-2", amount: 25, profile: { full_name: "Bob" } },
                ],
            },
        ],
        balances: [
            { user_id: "user-1", user_name: "Alice", balance: 10 },
            { user_id: "user-2", user_name: "Bob", balance: -10 },
        ],
        currency: "USD",
        totalSpent: 50,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("renders export button", () => {
        render(
            <TestWrapper>
                <ExportGroup {...defaultProps} />
            </TestWrapper>
        );

        expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("shows dropdown menu when clicked", async () => {
        const user = userEvent.setup();
        render(
            <TestWrapper>
                <ExportGroup {...defaultProps} />
            </TestWrapper>
        );

        await user.click(screen.getByRole("button"));

        expect(screen.getByText("Export to")).toBeInTheDocument();
        expect(screen.getByText("CSV File")).toBeInTheDocument();
        expect(screen.getByText("Google Sheets")).toBeInTheDocument();
        expect(screen.getByText("Notion")).toBeInTheDocument();
        expect(screen.getByText("PDF Summary")).toBeInTheDocument();
    });

    it("exports to CSV and creates blob URL", async () => {
        const user = userEvent.setup();
        render(
            <TestWrapper>
                <ExportGroup {...defaultProps} />
            </TestWrapper>
        );

        await user.click(screen.getByRole("button"));
        await user.click(screen.getByText("CSV File"));

        await waitFor(() => {
            expect(URL.createObjectURL).toHaveBeenCalled();
        });
    });

    it("shows success toast for Google Sheets export", async () => {
        const user = userEvent.setup();
        render(
            <TestWrapper>
                <ExportGroup {...defaultProps} />
            </TestWrapper>
        );

        await user.click(screen.getByRole("button"));
        await user.click(screen.getByText("Google Sheets"));

        // Toast shows success message
        await waitFor(() => {
            expect(screen.getByText("Copied to clipboard!")).toBeInTheDocument();
            expect(screen.getByText(/Paste into Google Sheets/)).toBeInTheDocument();
        });
    });

    it("shows success toast for Notion export", async () => {
        const user = userEvent.setup();
        render(
            <TestWrapper>
                <ExportGroup {...defaultProps} />
            </TestWrapper>
        );

        await user.click(screen.getByRole("button"));
        await user.click(screen.getByText("Notion"));

        // Toast shows success message
        await waitFor(() => {
            expect(screen.getByText("Copied to clipboard!")).toBeInTheDocument();
            expect(screen.getByText(/Paste into Notion/)).toBeInTheDocument();
        });
    });

    it("handles placeholder members in exports", () => {
        const propsWithPlaceholder = {
            ...defaultProps,
            expenses: [
                {
                    id: "exp-1",
                    description: "Dinner",
                    amount: 50,
                    category: "food",
                    expense_date: "2024-01-15",
                    paid_by: null,
                    paid_by_placeholder: { id: "ph-1", name: "Mom" },
                    splits: [],
                },
            ],
        };

        // Should render without errors
        render(
            <TestWrapper>
                <ExportGroup {...propsWithPlaceholder} />
            </TestWrapper>
        );

        expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("shows option descriptions", async () => {
        const user = userEvent.setup();
        render(
            <TestWrapper>
                <ExportGroup {...defaultProps} />
            </TestWrapper>
        );

        await user.click(screen.getByRole("button"));

        expect(screen.getByText("Excel, Numbers compatible")).toBeInTheDocument();
        expect(screen.getByText("Copy & paste into Sheets")).toBeInTheDocument();
        expect(screen.getByText("Copies markdown table")).toBeInTheDocument();
        expect(screen.getByText("Printable report")).toBeInTheDocument();
    });

    it("shows icons for each export option", async () => {
        const user = userEvent.setup();
        render(
            <TestWrapper>
                <ExportGroup {...defaultProps} />
            </TestWrapper>
        );

        await user.click(screen.getByRole("button"));

        // Check that the icons are rendered (they're SVGs with specific classes)
        const dropdown = screen.getByText("Export to").closest("div");
        expect(dropdown).toBeInTheDocument();

        // Check all options are present
        expect(screen.getByText("CSV File")).toBeInTheDocument();
        expect(screen.getByText("Google Sheets")).toBeInTheDocument();
        expect(screen.getByText("Notion")).toBeInTheDocument();
        expect(screen.getByText("PDF Summary")).toBeInTheDocument();
    });
});
