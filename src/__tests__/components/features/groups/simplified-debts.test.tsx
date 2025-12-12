import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SimplifiedDebts } from "@/components/features/groups/simplified-debts";
import { groupsService } from "@/services/groups";
import type { Balance } from "@/lib/simplify-debts";

jest.mock("@/services/groups", () => ({
    groupsService: { recordSettlement: jest.fn() },
}));

const mockRecordSettlement = groupsService.recordSettlement as jest.MockedFunction<typeof groupsService.recordSettlement>;

describe("SimplifiedDebts", () => {
    const defaultProps = { groupId: "group-1", currentUserId: "user-1", onSettle: jest.fn() };

    beforeEach(() => jest.clearAllMocks());

    it("shows 'All settled up' when no outstanding balances", () => {
        render(<SimplifiedDebts {...defaultProps} balances={[{ user_id: "user-1", user_name: "Alice", balance: 0 }]} />);
        expect(screen.getByText("All settled up! 🎉")).toBeInTheDocument();
    });

    it("renders simplified payments correctly", () => {
        const balances: Balance[] = [
            { user_id: "user-1", user_name: "Alice", balance: 50 },
            { user_id: "user-2", user_name: "Bob", balance: -50 },
        ];
        render(<SimplifiedDebts {...defaultProps} balances={balances} />);
        expect(screen.getByText("Simplified Debts")).toBeInTheDocument();
        expect(screen.getByText("1 payment")).toBeInTheDocument();
    });

    it("shows Settle button when user owes money", () => {
        const balances: Balance[] = [
            { user_id: "user-1", user_name: "Alice", balance: -50 },
            { user_id: "user-2", user_name: "Bob", balance: 50 },
        ];
        render(<SimplifiedDebts {...defaultProps} balances={balances} />);
        expect(screen.getByRole("button", { name: /settle/i })).toBeInTheDocument();
    });

    it("handles settlement action", async () => {
        const user = userEvent.setup();
        mockRecordSettlement.mockResolvedValue({ success: true });
        const balances: Balance[] = [
            { user_id: "user-1", user_name: "Alice", balance: -50 },
            { user_id: "user-2", user_name: "Bob", balance: 50 },
        ];
        render(<SimplifiedDebts {...defaultProps} balances={balances} />);

        await user.click(screen.getByRole("button", { name: /settle/i }));

        await waitFor(() => expect(mockRecordSettlement).toHaveBeenCalled());
    });

    it("shows placeholder member badge", () => {
        const balances: Balance[] = [
            { user_id: "user-1", user_name: "Alice", balance: 50 },
            { user_id: "ph-1", user_name: "Mom", balance: -50, is_placeholder: true },
        ];
        render(<SimplifiedDebts {...defaultProps} balances={balances} />);
        expect(screen.getByText("Not signed up")).toBeInTheDocument();
    });
});

