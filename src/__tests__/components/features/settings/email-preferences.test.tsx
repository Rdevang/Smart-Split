import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmailPreferencesForm } from "@/components/features/settings/email-preferences";
import { ToastProvider } from "@/components/ui/toast";

// Mock fetch
global.fetch = jest.fn();

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <ToastProvider>{children}</ToastProvider>
);

const defaultPreferences = {
    payment_reminders: true,
    settlement_requests: true,
    settlement_updates: true,
    group_invitations: true,
    expense_added: false,
    weekly_digest: true,
};

describe("EmailPreferencesForm", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("renders all email preference options", () => {
        render(
            <EmailPreferencesForm 
                userId="test-user-id" 
                initialPreferences={defaultPreferences} 
            />,
            { wrapper: TestWrapper }
        );

        expect(screen.getByText("Payment Reminders")).toBeInTheDocument();
        expect(screen.getByText("Settlement Requests")).toBeInTheDocument();
        expect(screen.getByText("Settlement Updates")).toBeInTheDocument();
        expect(screen.getByText("Group Invitations")).toBeInTheDocument();
        expect(screen.getByText("New Expenses")).toBeInTheDocument();
        expect(screen.getByText("Weekly Digest")).toBeInTheDocument();
    });

    it("renders header and description", () => {
        render(
            <EmailPreferencesForm 
                userId="test-user-id" 
                initialPreferences={defaultPreferences} 
            />,
            { wrapper: TestWrapper }
        );

        expect(screen.getByText("Email Notifications")).toBeInTheDocument();
        expect(screen.getByText("Choose which emails you'd like to receive")).toBeInTheDocument();
    });

    it("shows correct initial state for preferences", () => {
        render(
            <EmailPreferencesForm 
                userId="test-user-id" 
                initialPreferences={defaultPreferences} 
            />,
            { wrapper: TestWrapper }
        );

        // Payment reminders should be enabled (teal background)
        const paymentButton = screen.getByText("Payment Reminders").closest("button");
        expect(paymentButton).toHaveClass("bg-teal-50");

        // New Expenses should be disabled (gray background)  
        const expenseButton = screen.getByText("New Expenses").closest("button");
        expect(expenseButton).toHaveClass("bg-gray-50");
    });

    it("toggles preference when clicked", async () => {
        const user = userEvent.setup();
        
        render(
            <EmailPreferencesForm 
                userId="test-user-id" 
                initialPreferences={defaultPreferences} 
            />,
            { wrapper: TestWrapper }
        );

        const paymentButton = screen.getByText("Payment Reminders").closest("button")!;
        
        // Initially enabled
        expect(paymentButton).toHaveClass("bg-teal-50");
        
        // Click to toggle
        await user.click(paymentButton);
        
        // Now disabled
        expect(paymentButton).toHaveClass("bg-gray-50");
    });

    it("enables save button after making changes", async () => {
        const user = userEvent.setup();
        
        render(
            <EmailPreferencesForm 
                userId="test-user-id" 
                initialPreferences={defaultPreferences} 
            />,
            { wrapper: TestWrapper }
        );

        const saveButton = screen.getByRole("button", { name: /Save Preferences/i });
        
        // Initially disabled
        expect(saveButton).toBeDisabled();
        
        // Make a change
        const paymentButton = screen.getByText("Payment Reminders").closest("button")!;
        await user.click(paymentButton);
        
        // Now enabled
        expect(saveButton).not.toBeDisabled();
    });

    it("calls API when saving preferences", async () => {
        const user = userEvent.setup();
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ success: true }),
        });

        render(
            <EmailPreferencesForm 
                userId="test-user-id" 
                initialPreferences={defaultPreferences} 
            />,
            { wrapper: TestWrapper }
        );

        // Make a change
        const paymentButton = screen.getByText("Payment Reminders").closest("button")!;
        await user.click(paymentButton);
        
        // Save
        const saveButton = screen.getByRole("button", { name: /Save Preferences/i });
        await user.click(saveButton);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                "/api/settings/email-preferences",
                expect.objectContaining({
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                })
            );
        });
    });

    it("shows loading state while saving", async () => {
        const user = userEvent.setup();
        
        // Slow response
        (global.fetch as jest.Mock).mockImplementation(
            () => new Promise((resolve) => setTimeout(() => resolve({ ok: true, json: () => ({ success: true }) }), 100))
        );

        render(
            <EmailPreferencesForm 
                userId="test-user-id" 
                initialPreferences={defaultPreferences} 
            />,
            { wrapper: TestWrapper }
        );

        // Make a change and save
        const paymentButton = screen.getByText("Payment Reminders").closest("button")!;
        await user.click(paymentButton);
        
        const saveButton = screen.getByRole("button", { name: /Save Preferences/i });
        await user.click(saveButton);

        expect(screen.getByText("Saving...")).toBeInTheDocument();
    });

    it("renders descriptions for each preference", () => {
        render(
            <EmailPreferencesForm 
                userId="test-user-id" 
                initialPreferences={defaultPreferences} 
            />,
            { wrapper: TestWrapper }
        );

        expect(screen.getByText("Get notified when someone reminds you to pay")).toBeInTheDocument();
        expect(screen.getByText("Receive a weekly summary of your expenses and balances")).toBeInTheDocument();
    });
});

