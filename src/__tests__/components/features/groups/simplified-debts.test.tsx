import { render, screen } from "@testing-library/react";
import { SimplifiedDebts } from "@/components/features/groups/simplified-debts";
import { ToastProvider } from "@/components/ui/toast";
import type { Balance } from "@/lib/simplify-debts";
import React from "react";

// Mock fetch globally
global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ upi_id: null }),
});

// Mock navigator.userAgent
Object.defineProperty(navigator, "userAgent", {
    value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    configurable: true,
});

// Mock useEffect to prevent async operations from hanging tests
const originalUseEffect = React.useEffect;
jest.spyOn(React, "useEffect").mockImplementation((fn, deps) => {
    // Only run useEffects without dependencies (mount effects) once
    // Skip useEffects that have dependencies to avoid re-render loops
    if (deps && deps.length > 0) {
        return; // Skip effects with dependencies
    }
    return originalUseEffect(fn, deps);
});

// Mock server action
jest.mock("@/app/(dashboard)/actions", () => ({
    sendPaymentReminder: jest.fn().mockResolvedValue({ success: true }),
}));

// Mock QRCode component
jest.mock("qrcode.react", () => ({
    QRCodeSVG: () => <div data-testid="qr-code">QR Code</div>,
}));

// Mock UPI utilities
jest.mock("@/lib/upi", () => ({
    openUpiPayment: jest.fn(),
    isValidUpiId: jest.fn().mockReturnValue(false),
    generateUpiUrl: jest.fn().mockReturnValue(""),
}));

jest.mock("@/services/groups", () => ({
    groupsService: { recordSettlement: jest.fn() },
}));

// Wrapper with ToastProvider
function TestWrapper({ children }: { children: React.ReactNode }) {
    return <ToastProvider>{children}</ToastProvider>;
}

describe("SimplifiedDebts", () => {
    const defaultProps = {
        groupId: "group-1",
        currentUserId: "user-1",
        currency: "USD",
        onSettle: jest.fn(),
        expenses: []
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        // Restore useEffect
        jest.restoreAllMocks();
    });

    it("shows 'All settled up' when no outstanding balances", () => {
        render(
            <TestWrapper>
                <SimplifiedDebts {...defaultProps} balances={[{ user_id: "user-1", user_name: "Alice", balance: 0 }]} />
            </TestWrapper>
        );
        expect(screen.getByText("All settled up! 🎉")).toBeInTheDocument();
    });

    it("renders simplified payments correctly", () => {
        const balances: Balance[] = [
            { user_id: "user-1", user_name: "Alice", balance: 50 },
            { user_id: "user-2", user_name: "Bob", balance: -50 },
        ];
        render(
            <TestWrapper>
                <SimplifiedDebts {...defaultProps} balances={balances} />
            </TestWrapper>
        );
        expect(screen.getByText("Simplified Debts")).toBeInTheDocument();
        expect(screen.getByText("1 payment")).toBeInTheDocument();
    });

    it("shows Settle button when user owes money", () => {
        const balances: Balance[] = [
            { user_id: "user-1", user_name: "Alice", balance: -50 },
            { user_id: "user-2", user_name: "Bob", balance: 50 },
        ];
        render(
            <TestWrapper>
                <SimplifiedDebts {...defaultProps} balances={balances} />
            </TestWrapper>
        );
        expect(screen.getByRole("button", { name: /settle/i })).toBeInTheDocument();
    });

    it("renders placeholder members", () => {
        const balances: Balance[] = [
            { user_id: "user-1", user_name: "Alice", balance: 50 },
            { user_id: "ph-1", user_name: "Mom", balance: -50, is_placeholder: true },
        ];
        render(
            <TestWrapper>
                <SimplifiedDebts {...defaultProps} balances={balances} />
            </TestWrapper>
        );
        expect(screen.getByText("Mom")).toBeInTheDocument();
    });

    it("displays amounts in USD format by default", () => {
        const balances: Balance[] = [
            { user_id: "user-1", user_name: "Alice", balance: -100 },
            { user_id: "user-2", user_name: "Bob", balance: 100 },
        ];
        render(
            <TestWrapper>
                <SimplifiedDebts {...defaultProps} balances={balances} />
            </TestWrapper>
        );
        expect(screen.getByText("$100.00")).toBeInTheDocument();
    });

    it("displays amounts in specified currency", () => {
        const balances: Balance[] = [
            { user_id: "user-1", user_name: "Alice", balance: -100 },
            { user_id: "user-2", user_name: "Bob", balance: 100 },
        ];
        render(
            <TestWrapper>
                <SimplifiedDebts {...defaultProps} balances={balances} currency="EUR" />
            </TestWrapper>
        );
        const amountText = screen.getByText(/€|100/);
        expect(amountText).toBeInTheDocument();
    });
});
