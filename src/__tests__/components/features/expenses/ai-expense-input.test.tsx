import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AIExpenseInput } from "@/components/features/expenses/ai-expense-input";
import { ToastProvider } from "@/components/ui/toast";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock currency formatter
jest.mock("@/lib/currency", () => ({
    formatCurrency: (amount: number) => `₹${amount.toFixed(2)}`,
}));

// Wrapper with ToastProvider
function TestWrapper({ children }: { children: React.ReactNode }) {
    return <ToastProvider>{children}</ToastProvider>;
}

describe("AIExpenseInput", () => {
    const defaultProps = {
        groupId: "group-123",
        onExpenseParsed: jest.fn(),
        onReceiptScanned: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        // Default: user has remaining AI requests
        mockFetch.mockImplementation((url: string) => {
            if (url.includes("check-usage")) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        usage: { used: 0, limit: 1, remaining: 1, allowed: true, resetAt: new Date().toISOString() },
                    }),
                });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        });
    });

    it("renders AI badge and input area", async () => {
        render(
            <TestWrapper>
                <AIExpenseInput {...defaultProps} />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText("AI-Powered")).toBeInTheDocument();
        });
        expect(screen.getByPlaceholderText(/Try: "Paid/)).toBeInTheDocument();
    });

    it("shows example buttons", async () => {
        render(
            <TestWrapper>
                <AIExpenseInput {...defaultProps} />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText("Try:")).toBeInTheDocument();
        });
        expect(screen.getByText("Dinner ₹800 split with Mom")).toBeInTheDocument();
        expect(screen.getByText("Uber ₹200")).toBeInTheDocument();
    });

    it("fills textarea when clicking example", async () => {
        const user = userEvent.setup();
        render(
            <TestWrapper>
                <AIExpenseInput {...defaultProps} />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText("Uber ₹200")).toBeInTheDocument();
        });

        await user.click(screen.getByText("Uber ₹200"));

        const textarea = screen.getByPlaceholderText(/Try: "Paid/) as HTMLTextAreaElement;
        expect(textarea.value).toBe("Uber ₹200");
    });

    it("shows Parse with AI button", async () => {
        render(
            <TestWrapper>
                <AIExpenseInput {...defaultProps} />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByRole("button", { name: /Parse with AI/i })).toBeInTheDocument();
        });
    });

    it("disables parse button when input is empty", async () => {
        render(
            <TestWrapper>
                <AIExpenseInput {...defaultProps} />
            </TestWrapper>
        );

        await waitFor(() => {
            const parseButton = screen.getByRole("button", { name: /Parse with AI/i });
            expect(parseButton).toBeDisabled();
        });
    });

    it("enables parse button when input has text", async () => {
        const user = userEvent.setup();
        render(
            <TestWrapper>
                <AIExpenseInput {...defaultProps} />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByPlaceholderText(/Try: "Paid/)).toBeInTheDocument();
        });

        const textarea = screen.getByPlaceholderText(/Try: "Paid/);
        await user.type(textarea, "Dinner 500");

        const parseButton = screen.getByRole("button", { name: /Parse with AI/i });
        expect(parseButton).not.toBeDisabled();
    });

    it("shows Daily Limit Reached when usage is exhausted", async () => {
        mockFetch.mockImplementation((url: string) => {
            if (url.includes("check-usage")) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        usage: { used: 1, limit: 1, remaining: 0, allowed: false, resetAt: new Date(Date.now() + 86400000).toISOString() },
                    }),
                });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        });

        render(
            <TestWrapper>
                <AIExpenseInput {...defaultProps} />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText("Daily Limit Reached")).toBeInTheDocument();
        });
        expect(screen.getByText(/You've used your 1 AI request/)).toBeInTheDocument();
    });

    it("calls onExpenseParsed when AI parses successfully", async () => {
        const user = userEvent.setup();
        const mockParsedExpense = {
            description: "Dinner",
            amount: 500,
            category: "food",
            date: "2024-01-15",
            splitType: "equal",
            participants: [],
            currency: "INR",
            confidence: 0.9,
        };

        mockFetch.mockImplementation((url: string, options?: RequestInit) => {
            if (url.includes("check-usage")) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        usage: { used: 0, limit: 1, remaining: 1, allowed: true },
                    }),
                });
            }
            if (url.includes("parse-expense") && options?.method === "POST") {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        expense: mockParsedExpense,
                        usage: { used: 1, limit: 1, remaining: 0 },
                    }),
                });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        });

        render(
            <TestWrapper>
                <AIExpenseInput {...defaultProps} />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByPlaceholderText(/Try: "Paid/)).toBeInTheDocument();
        });

        const textarea = screen.getByPlaceholderText(/Try: "Paid/);
        await user.type(textarea, "Dinner 500");

        const parseButton = screen.getByRole("button", { name: /Parse with AI/i });
        await user.click(parseButton);

        await waitFor(() => {
            expect(defaultProps.onExpenseParsed).toHaveBeenCalledWith(mockParsedExpense);
        });
    });

    it("shows error toast when AI request fails", async () => {
        const user = userEvent.setup();
        mockFetch.mockImplementation((url: string, options?: RequestInit) => {
            if (url.includes("check-usage")) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        usage: { used: 0, limit: 1, remaining: 1, allowed: true },
                    }),
                });
            }
            if (url.includes("parse-expense") && options?.method === "POST") {
                return Promise.resolve({
                    ok: false,
                    status: 500,
                    json: () => Promise.resolve({ error: "Failed to parse expense" }),
                });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        });

        render(
            <TestWrapper>
                <AIExpenseInput {...defaultProps} />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByPlaceholderText(/Try: "Paid/)).toBeInTheDocument();
        });

        const textarea = screen.getByPlaceholderText(/Try: "Paid/);
        await user.type(textarea, "Dinner 500");

        const parseButton = screen.getByRole("button", { name: /Parse with AI/i });
        await user.click(parseButton);

        await waitFor(() => {
            expect(screen.getByText("Failed to parse expense")).toBeInTheDocument();
        });
    });

    it("shows rate limit toast when 429 response", async () => {
        const user = userEvent.setup();
        mockFetch.mockImplementation((url: string, options?: RequestInit) => {
            if (url.includes("check-usage")) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        usage: { used: 0, limit: 1, remaining: 1, allowed: true },
                    }),
                });
            }
            if (url.includes("parse-expense") && options?.method === "POST") {
                return Promise.resolve({
                    ok: false,
                    status: 429,
                    json: () => Promise.resolve({ error: "Daily limit reached" }),
                });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        });

        render(
            <TestWrapper>
                <AIExpenseInput {...defaultProps} />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByPlaceholderText(/Try: "Paid/)).toBeInTheDocument();
        });

        const textarea = screen.getByPlaceholderText(/Try: "Paid/);
        await user.type(textarea, "Dinner 500");

        const parseButton = screen.getByRole("button", { name: /Parse with AI/i });
        await user.click(parseButton);

        await waitFor(() => {
            expect(screen.getByText("Daily Limit Reached")).toBeInTheDocument();
        });
    });

    it("shows voice input button", async () => {
        render(
            <TestWrapper>
                <AIExpenseInput {...defaultProps} />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByTitle("Voice input")).toBeInTheDocument();
        });
    });

    it("shows receipt scanner button when onReceiptScanned is provided", async () => {
        render(
            <TestWrapper>
                <AIExpenseInput {...defaultProps} onReceiptScanned={jest.fn()} />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByTitle("Scan receipt")).toBeInTheDocument();
        });
    });

    it("hides receipt scanner button when onReceiptScanned is not provided", async () => {
        render(
            <TestWrapper>
                <AIExpenseInput {...defaultProps} onReceiptScanned={undefined} />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.queryByTitle("Scan receipt")).not.toBeInTheDocument();
        });
    });

    it("clears input when clear button is clicked", async () => {
        const user = userEvent.setup();
        render(
            <TestWrapper>
                <AIExpenseInput {...defaultProps} />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByPlaceholderText(/Try: "Paid/)).toBeInTheDocument();
        });

        const textarea = screen.getByPlaceholderText(/Try: "Paid/) as HTMLTextAreaElement;
        await user.type(textarea, "Test expense");

        // Find and click clear button (X icon)
        const clearButtons = screen.getAllByRole("button");
        const clearButton = clearButtons.find(btn => btn.querySelector("svg.lucide-x"));
        if (clearButton) {
            await user.click(clearButton);
        }

        expect(textarea.value).toBe("");
    });

    it("respects disabled prop", async () => {
        render(
            <TestWrapper>
                <AIExpenseInput {...defaultProps} disabled={true} />
            </TestWrapper>
        );

        await waitFor(() => {
            const textarea = screen.getByPlaceholderText(/Try: "Paid/);
            expect(textarea).toBeDisabled();
        });
    });
});

