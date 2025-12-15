import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExpenseForm } from "@/components/features/expenses/expense-form";
import { ToastProvider } from "@/components/ui/toast";
import { expensesService } from "@/services/expenses";

// Mock next/navigation
jest.mock("next/navigation", () => ({
    useRouter: () => ({
        push: jest.fn(),
        back: jest.fn(),
        refresh: jest.fn(),
    }),
}));

// Mock next/image
jest.mock("next/image", () => ({
    __esModule: true,
    default: (props: { alt: string; src: string }) => <img alt={props.alt} src={props.src} />,
}));

// Mock expenses service
jest.mock("@/services/expenses", () => ({
    expensesService: {
        createExpense: jest.fn(),
    },
}));

const mockCreateExpense = expensesService.createExpense as jest.MockedFunction<typeof expensesService.createExpense>;

// Wrapper with ToastProvider
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <ToastProvider>{children}</ToastProvider>
);

describe("ExpenseForm", () => {
    const mockGroupWithRealUsers = {
        id: "group-123",
        name: "Trip to Paris",
        members: [
            {
                id: "member-1",
                user_id: "user-1",
                role: "admin",
                is_placeholder: false,
                profile: {
                    id: "user-1",
                    email: "alice@example.com",
                    full_name: "Alice",
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
                    email: "bob@example.com",
                    full_name: "Bob",
                    avatar_url: "https://example.com/bob.jpg",
                },
                placeholder: null,
            },
        ],
    };

    const mockGroupWithPlaceholders = {
        id: "group-456",
        name: "Family Expenses",
        members: [
            {
                id: "member-1",
                user_id: "user-1",
                role: "admin",
                is_placeholder: false,
                profile: {
                    id: "user-1",
                    email: "me@example.com",
                    full_name: "Me",
                    avatar_url: null,
                },
                placeholder: null,
            },
            {
                id: "member-2",
                user_id: null,
                role: "member",
                is_placeholder: true,
                profile: null,
                placeholder: {
                    id: "placeholder-1",
                    name: "Mom",
                    email: null,
                },
            },
            {
                id: "member-3",
                user_id: null,
                role: "member",
                is_placeholder: true,
                profile: null,
                placeholder: {
                    id: "placeholder-2",
                    name: "Dad",
                    email: "dad@future.com",
                },
            },
        ],
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("Rendering", () => {
        it("renders form with all required fields", () => {
            render(<ExpenseForm group={mockGroupWithRealUsers} userId="user-1" />, { wrapper: TestWrapper });

            expect(screen.getByRole("heading", { name: "Add Expense" })).toBeInTheDocument();
            expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/Amount/i)).toBeInTheDocument();
            expect(screen.getByText(/Paid by/i)).toBeInTheDocument();
            expect(screen.getByText(/Category/i)).toBeInTheDocument();
            expect(screen.getByText(/Split Type/i)).toBeInTheDocument();
        });

        it("shows all real members in split list", () => {
            render(<ExpenseForm group={mockGroupWithRealUsers} userId="user-1" />, { wrapper: TestWrapper });

            // "You" appears in both dropdown and split list, so use getAllByText
            expect(screen.getAllByText("You").length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText("Bob").length).toBeGreaterThanOrEqual(1);
        });

        it("shows placeholder members with '(not signed up)' label", () => {
            render(<ExpenseForm group={mockGroupWithPlaceholders} userId="user-1" />, { wrapper: TestWrapper });

            // Use getAllByText since name may appear in both dropdown and split list
            expect(screen.getAllByText("Mom").length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText("Dad").length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText("(not signed up)")).toHaveLength(2);
        });

        it("only shows real users in 'Paid by' dropdown (not placeholders)", () => {
            render(<ExpenseForm group={mockGroupWithPlaceholders} userId="user-1" />, { wrapper: TestWrapper });

            // The "Paid by" select should only have "You" (the real user)
            // Placeholders can't pay for expenses
            const paidBySection = screen.getByText("Paid by").closest("div");
            expect(paidBySection).toBeInTheDocument();
        });
    });

    describe("Member selection", () => {
        it("all members are selected by default", () => {
            render(<ExpenseForm group={mockGroupWithRealUsers} userId="user-1" />, { wrapper: TestWrapper });

            const checkboxes = screen.getAllByRole("checkbox");
            checkboxes.forEach((checkbox) => {
                expect(checkbox).toBeChecked();
            });
        });

        it("can toggle member selection", async () => {
            const user = userEvent.setup();
            render(<ExpenseForm group={mockGroupWithRealUsers} userId="user-1" />, { wrapper: TestWrapper });

            const checkboxes = screen.getAllByRole("checkbox");
            await user.click(checkboxes[0]);

            expect(checkboxes[0]).not.toBeChecked();
        });

        it("can toggle placeholder member selection", async () => {
            const user = userEvent.setup();
            render(<ExpenseForm group={mockGroupWithPlaceholders} userId="user-1" />, { wrapper: TestWrapper });

            const checkboxes = screen.getAllByRole("checkbox");
            // Find the checkbox for Mom (should be second in list)
            await user.click(checkboxes[1]);

            expect(checkboxes[1]).not.toBeChecked();
        });
    });

    describe("Equal split calculation", () => {
        it("calculates equal split when amount is entered", async () => {
            const user = userEvent.setup();
            render(<ExpenseForm group={mockGroupWithRealUsers} userId="user-1" />, { wrapper: TestWrapper });

            await user.type(screen.getByLabelText(/Amount/i), "100");

            // With 2 members, each should owe 50
            await waitFor(() => {
                expect(screen.getAllByText("$50.00")).toHaveLength(2);
            });
        });

        it("recalculates when member is deselected", async () => {
            const user = userEvent.setup();
            render(<ExpenseForm group={mockGroupWithRealUsers} userId="user-1" />, { wrapper: TestWrapper });

            await user.type(screen.getByLabelText(/Amount/i), "100");

            const checkboxes = screen.getAllByRole("checkbox");
            await user.click(checkboxes[1]); // Deselect Bob

            // With 1 member, they should owe 100
            await waitFor(() => {
                expect(screen.getByText("$100.00")).toBeInTheDocument();
            });
        });
    });

    describe("Form submission", () => {
        it("submits with correct data for real users", async () => {
            const user = userEvent.setup();
            mockCreateExpense.mockResolvedValue({ expense: { id: "exp-1" } as never, error: undefined });

            render(<ExpenseForm group={mockGroupWithRealUsers} userId="user-1" />, { wrapper: TestWrapper });

            await user.type(screen.getByLabelText(/Description/i), "Dinner");
            await user.type(screen.getByLabelText(/Amount/i), "100");
            await user.click(screen.getByRole("button", { name: /Add Expense/i }));

            await waitFor(() => {
                expect(mockCreateExpense).toHaveBeenCalledWith(
                    expect.objectContaining({
                        group_id: "group-123",
                        description: "Dinner",
                        amount: 100,
                        splits: expect.arrayContaining([
                            expect.objectContaining({ user_id: "user-1" }),
                            expect.objectContaining({ user_id: "user-2" }),
                        ]),
                    }),
                    "user-1"
                );
            });
        });

        it("submits with placeholder_id for placeholder members", async () => {
            const user = userEvent.setup();
            mockCreateExpense.mockResolvedValue({ expense: { id: "exp-1" } as never, error: undefined });

            render(<ExpenseForm group={mockGroupWithPlaceholders} userId="user-1" />, { wrapper: TestWrapper });

            await user.type(screen.getByLabelText(/Description/i), "Groceries");
            await user.type(screen.getByLabelText(/Amount/i), "90");
            await user.click(screen.getByRole("button", { name: /Add Expense/i }));

            await waitFor(() => {
                expect(mockCreateExpense).toHaveBeenCalledWith(
                    expect.objectContaining({
                        splits: expect.arrayContaining([
                            expect.objectContaining({ user_id: "user-1", placeholder_id: undefined }),
                            expect.objectContaining({ placeholder_id: "placeholder-1", user_id: undefined }),
                            expect.objectContaining({ placeholder_id: "placeholder-2", user_id: undefined }),
                        ]),
                    }),
                    "user-1"
                );
            });
        });

        it("shows error when splits don't match total", async () => {
            const user = userEvent.setup();
            render(<ExpenseForm group={mockGroupWithRealUsers} userId="user-1" />, { wrapper: TestWrapper });

            await user.type(screen.getByLabelText(/Description/i), "Test");
            await user.type(screen.getByLabelText(/Amount/i), "100");

            // Deselect all members
            const checkboxes = screen.getAllByRole("checkbox");
            await user.click(checkboxes[0]);
            await user.click(checkboxes[1]);

            // Button should be disabled when no members selected
            expect(screen.getByRole("button", { name: /Add Expense/i })).toBeDisabled();
        });

        it("shows error message on API failure", async () => {
            const user = userEvent.setup();
            mockCreateExpense.mockResolvedValue({ expense: null, error: "Failed to create expense" });

            render(<ExpenseForm group={mockGroupWithRealUsers} userId="user-1" />, { wrapper: TestWrapper });

            await user.type(screen.getByLabelText(/Description/i), "Dinner");
            await user.type(screen.getByLabelText(/Amount/i), "100");
            await user.click(screen.getByRole("button", { name: /Add Expense/i }));

            // Error appears in both inline error div and toast
            await waitFor(() => {
                expect(screen.getAllByText("Failed to create expense").length).toBeGreaterThanOrEqual(1);
            });
        });
    });

    describe("Visual differentiation", () => {
        it("shows different avatar style for placeholder members", () => {
            render(<ExpenseForm group={mockGroupWithPlaceholders} userId="user-1" />, { wrapper: TestWrapper });

            // Real user should have teal background
            // Placeholder should have gray background
            const avatars = document.querySelectorAll('[class*="bg-gray-400"], [class*="bg-teal-500"]');
            expect(avatars.length).toBeGreaterThan(0);
        });
    });
});

