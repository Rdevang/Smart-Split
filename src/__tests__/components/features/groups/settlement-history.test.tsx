import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettlementHistory } from "@/components/features/groups/settlement-history";
import { groupsService } from "@/services/groups";

// Mock next/navigation
jest.mock("next/navigation", () => ({
    useRouter: () => ({
        push: jest.fn(),
        refresh: jest.fn(),
    }),
}));

// Mock groups service
jest.mock("@/services/groups", () => ({
    groupsService: {
        getSettlementsWithNames: jest.fn(),
    },
}));

const mockGetSettlementsWithNames = groupsService.getSettlementsWithNames as jest.Mock;

describe("SettlementHistory", () => {
    const defaultProps = {
        groupId: "group-123",
        currentUserId: "user-1",
        currency: "USD",
    };

    const mockSettlements = [
        {
            id: "settlement-1",
            from_user: "user-1",
            from_user_name: "John Doe",
            to_user: "user-2",
            to_user_name: "Jane Smith",
            amount: 50.00,
            settled_at: "2024-12-15T10:30:00Z",
            note: null,
        },
        {
            id: "settlement-2",
            from_user: "user-2",
            from_user_name: "Jane Smith",
            to_user: "user-1",
            to_user_name: "John Doe",
            amount: 25.00,
            settled_at: "2024-12-14T15:00:00Z",
            note: null,
        },
        {
            id: "settlement-3",
            from_user: "user-3",
            from_user_name: "Bob Wilson",
            to_user: "user-2",
            to_user_name: "Jane Smith",
            amount: 30.00,
            settled_at: "2024-12-13T09:00:00Z",
            note: null,
        },
        {
            id: "settlement-4",
            from_user: "user-4",
            from_user_name: "Alice Brown",
            to_user: "user-1",
            to_user_name: "John Doe",
            amount: 15.00,
            settled_at: "2024-12-12T14:00:00Z",
            note: null,
        },
    ];

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("Rendering", () => {
        it("renders nothing when there are no settlements", async () => {
            const { container } = render(
                <SettlementHistory {...defaultProps} initialSettlements={[]} />
            );
            expect(container).toBeEmptyDOMElement();
        });

        it("renders settlement history card with settlements", () => {
            render(
                <SettlementHistory
                    {...defaultProps}
                    initialSettlements={mockSettlements.slice(0, 2)}
                />
            );

            expect(screen.getByText("Settlement History")).toBeInTheDocument();
            expect(screen.getByText("$75.00 settled")).toBeInTheDocument();
        });

        it("shows 'You' for current user in settlements", () => {
            render(
                <SettlementHistory
                    {...defaultProps}
                    initialSettlements={mockSettlements.slice(0, 1)}
                />
            );

            // User-1 is the from_user in the first settlement
            expect(screen.getByText("You")).toBeInTheDocument();
            expect(screen.getByText("Jane Smith")).toBeInTheDocument();
        });

        it("displays settlement amounts correctly", () => {
            render(
                <SettlementHistory
                    {...defaultProps}
                    initialSettlements={mockSettlements.slice(0, 2)}
                />
            );

            expect(screen.getByText("$50.00")).toBeInTheDocument();
            expect(screen.getByText("$25.00")).toBeInTheDocument();
        });

        it("displays amounts in specified currency", () => {
            render(
                <SettlementHistory
                    {...defaultProps}
                    currency="EUR"
                    initialSettlements={mockSettlements.slice(0, 1)}
                />
            );

            // Should show Euro format - look for the formatted amount
            const amountElements = screen.getAllByText(/50.*€|€.*50/);
            expect(amountElements.length).toBeGreaterThan(0);
        });
    });

    describe("Expand/Collapse functionality", () => {
        it("shows only first 3 settlements by default", () => {
            render(
                <SettlementHistory
                    {...defaultProps}
                    initialSettlements={mockSettlements}
                />
            );

            // First 3 should be visible
            expect(screen.getByText("$50.00")).toBeInTheDocument();
            expect(screen.getByText("$25.00")).toBeInTheDocument();
            expect(screen.getByText("$30.00")).toBeInTheDocument();

            // 4th should not be visible
            expect(screen.queryByText("$15.00")).not.toBeInTheDocument();
        });

        it("shows 'Show more' button when more than 3 settlements", () => {
            render(
                <SettlementHistory
                    {...defaultProps}
                    initialSettlements={mockSettlements}
                />
            );

            expect(screen.getByRole("button", { name: /Show 1 more/i })).toBeInTheDocument();
        });

        it("does not show expand button when 3 or fewer settlements", () => {
            render(
                <SettlementHistory
                    {...defaultProps}
                    initialSettlements={mockSettlements.slice(0, 3)}
                />
            );

            expect(screen.queryByRole("button", { name: /Show/i })).not.toBeInTheDocument();
        });

        it("expands to show all settlements when clicking 'Show more'", async () => {
            const user = userEvent.setup();
            render(
                <SettlementHistory
                    {...defaultProps}
                    initialSettlements={mockSettlements}
                />
            );

            await user.click(screen.getByRole("button", { name: /Show 1 more/i }));

            expect(screen.getByText("$15.00")).toBeInTheDocument();
            expect(screen.getByRole("button", { name: /Show less/i })).toBeInTheDocument();
        });

        it("collapses when clicking 'Show less'", async () => {
            const user = userEvent.setup();
            render(
                <SettlementHistory
                    {...defaultProps}
                    initialSettlements={mockSettlements}
                />
            );

            await user.click(screen.getByRole("button", { name: /Show 1 more/i }));
            await user.click(screen.getByRole("button", { name: /Show less/i }));

            expect(screen.queryByText("$15.00")).not.toBeInTheDocument();
        });
    });

    describe("Loading state", () => {
        it("shows loading spinner when fetching settlements", async () => {
            mockGetSettlementsWithNames.mockImplementation(() => new Promise(() => { }));

            render(<SettlementHistory {...defaultProps} />);

            // Should show loading state - query by role
            expect(screen.getByRole("status")).toBeInTheDocument();
            expect(screen.getByText("Loading...")).toBeInTheDocument();
        });

        it("fetches settlements when no initial data provided", async () => {
            mockGetSettlementsWithNames.mockResolvedValue(mockSettlements.slice(0, 2));

            render(<SettlementHistory {...defaultProps} />);

            await waitFor(() => {
                expect(mockGetSettlementsWithNames).toHaveBeenCalledWith("group-123");
            });

            await waitFor(() => {
                expect(screen.getByText("Settlement History")).toBeInTheDocument();
            });
        });
    });

    describe("Total calculation", () => {
        it("calculates total settled amount correctly", () => {
            render(
                <SettlementHistory
                    {...defaultProps}
                    initialSettlements={mockSettlements}
                />
            );

            // 50 + 25 + 30 + 15 = 120
            expect(screen.getByText("$120.00 settled")).toBeInTheDocument();
        });
    });
});
