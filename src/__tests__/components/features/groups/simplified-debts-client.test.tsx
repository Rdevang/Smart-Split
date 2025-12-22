import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SimplifiedDebtsClient } from "@/components/features/groups/simplified-debts-client";
import { ToastProvider } from "@/components/ui/toast";
import { groupsService } from "@/services/groups";

// Mock next/navigation
const mockRefresh = jest.fn();
jest.mock("next/navigation", () => ({
    useRouter: () => ({
        push: jest.fn(),
        refresh: mockRefresh,
    }),
}));

// Mock groups service
jest.mock("@/services/groups", () => ({
    groupsService: {
        recordSettlement: jest.fn(),
    },
}));

// Mock dashboard actions
jest.mock("@/app/(dashboard)/actions", () => ({
    onSettlementMutation: jest.fn().mockResolvedValue(undefined),
}));

const mockRecordSettlement = groupsService.recordSettlement as jest.Mock;

// Wrapper with ToastProvider
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <ToastProvider>{children}</ToastProvider>
);

describe("SimplifiedDebtsClient", () => {
    const defaultProps = {
        groupId: "group-123",
        currentUserId: "user-1",
        currency: "USD",
        balances: [
            { user_id: "user-1", user_name: "John", balance: -50 },
            { user_id: "user-2", user_name: "Jane", balance: 50 },
        ],
        expenses: [
            {
                id: "expense-1",
                paid_by: "user-2",
                paid_by_placeholder_id: null,
                paid_by_profile: { id: "user-2", full_name: "Jane" },
                paid_by_placeholder: null,
                splits: [
                    {
                        user_id: "user-1",
                        placeholder_id: null,
                        amount: 50,
                        is_settled: false,
                        profile: { id: "user-1", full_name: "John" },
                        placeholder: null,
                    },
                    {
                        user_id: "user-2",
                        placeholder_id: null,
                        amount: 50,
                        is_settled: false,
                        profile: { id: "user-2", full_name: "Jane" },
                        placeholder: null,
                    },
                ],
            },
        ],
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("renders the simplified debts component", () => {
        render(<SimplifiedDebtsClient {...defaultProps} />, { wrapper: TestWrapper });

        expect(screen.getByText("Simplified Debts")).toBeInTheDocument();
    });

    it("shows settle button for debts user owes", () => {
        render(<SimplifiedDebtsClient {...defaultProps} />, { wrapper: TestWrapper });

        expect(screen.getByRole("button", { name: /Settle/i })).toBeInTheDocument();
    });

    it("calls router.refresh after successful settlement", async () => {
        const user = userEvent.setup();
        mockRecordSettlement.mockResolvedValue({ success: true });

        render(<SimplifiedDebtsClient {...defaultProps} />, { wrapper: TestWrapper });

        const settleButton = screen.getByRole("button", { name: /Settle/i });
        await user.click(settleButton);

        // Wait for the router.refresh to be called
        await waitFor(() => {
            expect(mockRefresh).toHaveBeenCalled();
        });
    });

    it("shows all settled up message when no debts", () => {
        render(
            <SimplifiedDebtsClient
                {...defaultProps}
                balances={[
                    { user_id: "user-1", user_name: "John", balance: 0 },
                    { user_id: "user-2", user_name: "Jane", balance: 0 },
                ]}
            />,
            { wrapper: TestWrapper }
        );

        expect(screen.getByText("All settled up! 🎉")).toBeInTheDocument();
    });

    it("passes currency prop to SimplifiedDebts", () => {
        render(
            <SimplifiedDebtsClient {...defaultProps} currency="EUR" />,
            { wrapper: TestWrapper }
        );

        // The amount should be formatted with EUR
        const amountText = screen.getByText(/€|50/);
        expect(amountText).toBeInTheDocument();
    });
});
