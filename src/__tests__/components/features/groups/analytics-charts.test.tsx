import { render, screen } from "@testing-library/react";
import {
    CategoryChart,
    TrendChart,
    ContributionsChart,
    SpendByMemberChart,
    BalancesChart,
    DailyBreakdownChart,
    TopExpensesList,
} from "@/components/features/groups/analytics-charts";

// Mock Recharts components to avoid canvas/SVG issues in tests
jest.mock("recharts", () => ({
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="responsive-container">{children}</div>
    ),
    PieChart: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="pie-chart">{children}</div>
    ),
    Pie: () => <div data-testid="pie" />,
    Cell: () => <div data-testid="cell" />,
    BarChart: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="bar-chart">{children}</div>
    ),
    Bar: () => <div data-testid="bar" />,
    LineChart: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="line-chart">{children}</div>
    ),
    Line: () => <div data-testid="line" />,
    AreaChart: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="area-chart">{children}</div>
    ),
    Area: () => <div data-testid="area" />,
    XAxis: () => <div data-testid="x-axis" />,
    YAxis: () => <div data-testid="y-axis" />,
    CartesianGrid: () => <div data-testid="cartesian-grid" />,
    Tooltip: () => <div data-testid="tooltip" />,
    Legend: () => <div data-testid="legend" />,
    ReferenceLine: () => <div data-testid="reference-line" />,
}));

// Mock currency formatter
jest.mock("@/lib/currency", () => ({
    formatCurrency: (amount: number, currency: string) =>
        currency === "INR" ? `₹${amount.toFixed(2)}` : `$${amount.toFixed(2)}`,
}));

describe("Analytics Charts", () => {
    const mockExpenses = [
        {
            id: "exp-1",
            description: "Dinner",
            amount: 500,
            category: "food",
            expense_date: "2024-01-15",
            paid_by: "user-1",
            paid_by_profile: { id: "user-1", full_name: "Alice", avatar_url: null },
            splits: [
                { id: "s1", user_id: "user-1", amount: 250, profile: { id: "user-1", full_name: "Alice" } },
                { id: "s2", user_id: "user-2", amount: 250, profile: { id: "user-2", full_name: "Bob" } },
            ],
        },
        {
            id: "exp-2",
            description: "Uber",
            amount: 200,
            category: "transport",
            expense_date: "2024-01-16",
            paid_by: "user-2",
            paid_by_profile: { id: "user-2", full_name: "Bob", avatar_url: null },
            splits: [
                { id: "s3", user_id: "user-1", amount: 100, profile: { id: "user-1", full_name: "Alice" } },
                { id: "s4", user_id: "user-2", amount: 100, profile: { id: "user-2", full_name: "Bob" } },
            ],
        },
        {
            id: "exp-3",
            description: "Movie tickets",
            amount: 300,
            category: "entertainment",
            expense_date: "2024-01-17",
            paid_by: "user-1",
            paid_by_profile: { id: "user-1", full_name: "Alice", avatar_url: null },
            splits: [
                { id: "s5", user_id: "user-1", amount: 150, profile: { id: "user-1", full_name: "Alice" } },
                { id: "s6", user_id: "user-2", amount: 150, profile: { id: "user-2", full_name: "Bob" } },
            ],
        },
    ];

    const mockBalances = [
        { user_id: "user-1", user_name: "Alice", balance: 200 },
        { user_id: "user-2", user_name: "Bob", balance: -200 },
    ];

    describe("CategoryChart", () => {
        it("renders category breakdown", () => {
            render(<CategoryChart expenses={mockExpenses} currency="INR" />);

            expect(screen.getByTestId("pie-chart")).toBeInTheDocument();
        });

        it("shows empty state when no expenses", () => {
            render(<CategoryChart expenses={[]} currency="INR" />);

            expect(screen.getByText("No expense data available")).toBeInTheDocument();
        });

        it("displays category labels", () => {
            render(<CategoryChart expenses={mockExpenses} currency="INR" />);

            expect(screen.getByText("Food & Dining")).toBeInTheDocument();
            expect(screen.getByText("Transport")).toBeInTheDocument();
            expect(screen.getByText("Entertainment")).toBeInTheDocument();
        });

        it("shows category emojis", () => {
            render(<CategoryChart expenses={mockExpenses} currency="INR" />);

            expect(screen.getByText("🍔")).toBeInTheDocument();
            expect(screen.getByText("🚗")).toBeInTheDocument();
            expect(screen.getByText("🎬")).toBeInTheDocument();
        });

        it("displays total amount", () => {
            render(<CategoryChart expenses={mockExpenses} currency="INR" />);

            expect(screen.getByText("Total")).toBeInTheDocument();
            expect(screen.getByText("₹1000.00")).toBeInTheDocument();
        });

        it("displays category percentages", () => {
            render(<CategoryChart expenses={mockExpenses} currency="INR" />);

            // Food: 500/1000 = 50%, Transport: 200/1000 = 20%, Entertainment: 300/1000 = 30%
            expect(screen.getByText("50%")).toBeInTheDocument();
            expect(screen.getByText("20%")).toBeInTheDocument();
            expect(screen.getByText("30%")).toBeInTheDocument();
        });

        it("displays currency amounts for each category", () => {
            render(<CategoryChart expenses={mockExpenses} currency="INR" />);

            expect(screen.getByText("₹500.00")).toBeInTheDocument();
            expect(screen.getByText("₹200.00")).toBeInTheDocument();
            expect(screen.getByText("₹300.00")).toBeInTheDocument();
        });

        it("renders responsive container", () => {
            render(<CategoryChart expenses={mockExpenses} currency="INR" />);

            expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
        });

        it("handles expenses with null category as 'other'", () => {
            const expensesWithNullCategory = [
                {
                    id: "exp-1",
                    description: "Misc",
                    amount: 100,
                    category: null,
                    expense_date: "2024-01-15",
                    paid_by: "user-1",
                    paid_by_profile: { id: "user-1", full_name: "Alice", avatar_url: null },
                    splits: [],
                },
            ];

            render(<CategoryChart expenses={expensesWithNullCategory} currency="INR" />);

            expect(screen.getByText("Other")).toBeInTheDocument();
            expect(screen.getByText("📦")).toBeInTheDocument();
        });
    });

    describe("TrendChart", () => {
        it("renders trend area chart", () => {
            render(<TrendChart expenses={mockExpenses} currency="INR" />);

            expect(screen.getByTestId("area-chart")).toBeInTheDocument();
        });

        it("shows empty state when no expenses", () => {
            render(<TrendChart expenses={[]} currency="INR" />);

            expect(screen.getByText("No expense data available")).toBeInTheDocument();
        });

        it("shows trend indicator", () => {
            render(<TrendChart expenses={mockExpenses} currency="INR" />);

            // Should show some trend percentage
            expect(screen.getByText(/vs previous period/)).toBeInTheDocument();
        });
    });

    describe("ContributionsChart", () => {
        it("renders contributions", () => {
            render(<ContributionsChart expenses={mockExpenses} currency="INR" />);

            // Should show contributor names
            expect(screen.getByText("Alice")).toBeInTheDocument();
            expect(screen.getByText("Bob")).toBeInTheDocument();
        });

        it("shows empty state when no expenses", () => {
            render(<ContributionsChart expenses={[]} currency="INR" />);

            expect(screen.getByText("No contribution data available")).toBeInTheDocument();
        });

        it("shows amounts paid", () => {
            render(<ContributionsChart expenses={mockExpenses} currency="INR" />);

            // Alice paid 500 + 300 = 800
            expect(screen.getByText("₹800.00")).toBeInTheDocument();
            // Bob paid 200
            expect(screen.getByText("₹200.00")).toBeInTheDocument();
        });
    });

    describe("SpendByMemberChart", () => {
        it("renders member spend comparison", () => {
            render(
                <SpendByMemberChart
                    expenses={mockExpenses}
                    currency="INR"
                    currentUserId="user-1"
                />
            );

            expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
        });

        it("shows empty state when no expenses", () => {
            render(
                <SpendByMemberChart
                    expenses={[]}
                    currency="INR"
                    currentUserId="user-1"
                />
            );

            expect(screen.getByText("No member data available")).toBeInTheDocument();
        });

        it("renders without crashing for current user", () => {
            // The "You" text is rendered inside the chart, which is mocked
            // Just verify the chart renders without errors
            const { container } = render(
                <SpendByMemberChart
                    expenses={mockExpenses}
                    currency="INR"
                    currentUserId="user-1"
                />
            );

            expect(container).toBeInTheDocument();
            expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
        });
    });

    describe("BalancesChart", () => {
        it("renders balance bars", () => {
            render(
                <BalancesChart
                    balances={mockBalances}
                    currency="INR"
                    currentUserId="user-1"
                />
            );

            expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
        });

        it("shows empty state when no balances", () => {
            render(
                <BalancesChart
                    balances={[]}
                    currency="INR"
                    currentUserId="user-1"
                />
            );

            expect(screen.getByText("No balance data available")).toBeInTheDocument();
        });

        it("renders without crashing for current user", () => {
            // The "You" text is rendered inside the chart axes, which is mocked
            // Just verify the chart renders without errors
            const { container } = render(
                <BalancesChart
                    balances={mockBalances}
                    currency="INR"
                    currentUserId="user-1"
                />
            );

            expect(container).toBeInTheDocument();
            expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
        });
    });

    describe("DailyBreakdownChart", () => {
        it("renders daily breakdown", () => {
            render(<DailyBreakdownChart expenses={mockExpenses} currency="INR" />);

            // Should show day labels
            expect(screen.getByText("Mon")).toBeInTheDocument();
            expect(screen.getByText("Tue")).toBeInTheDocument();
            expect(screen.getByText("Wed")).toBeInTheDocument();
            expect(screen.getByText("Thu")).toBeInTheDocument();
            expect(screen.getByText("Fri")).toBeInTheDocument();
            expect(screen.getByText("Sat")).toBeInTheDocument();
            expect(screen.getByText("Sun")).toBeInTheDocument();
        });
    });

    describe("TopExpensesList", () => {
        it("renders top expenses", () => {
            render(<TopExpensesList expenses={mockExpenses} currency="INR" />);

            expect(screen.getByText("Dinner")).toBeInTheDocument();
            expect(screen.getByText("Movie tickets")).toBeInTheDocument();
            expect(screen.getByText("Uber")).toBeInTheDocument();
        });

        it("shows empty state when no expenses", () => {
            render(<TopExpensesList expenses={[]} currency="INR" />);

            expect(screen.getByText("No expenses yet")).toBeInTheDocument();
        });

        it("shows amounts", () => {
            render(<TopExpensesList expenses={mockExpenses} currency="INR" />);

            expect(screen.getByText("₹500.00")).toBeInTheDocument();
            expect(screen.getByText("₹300.00")).toBeInTheDocument();
            expect(screen.getByText("₹200.00")).toBeInTheDocument();
        });

        it("shows payer names", () => {
            render(<TopExpensesList expenses={mockExpenses} currency="INR" />);

            // Shows first name only
            expect(screen.getAllByText(/Paid by Alice/)).toHaveLength(2);
            expect(screen.getByText(/Paid by Bob/)).toBeInTheDocument();
        });

        it("respects limit prop", () => {
            render(<TopExpensesList expenses={mockExpenses} currency="INR" limit={2} />);

            // Should only show top 2 (Dinner and Movie tickets by amount)
            expect(screen.getByText("Dinner")).toBeInTheDocument();
            expect(screen.getByText("Movie tickets")).toBeInTheDocument();
            expect(screen.queryByText("Uber")).not.toBeInTheDocument();
        });

        it("shows ranking numbers", () => {
            render(<TopExpensesList expenses={mockExpenses} currency="INR" />);

            expect(screen.getByText("#1")).toBeInTheDocument();
            expect(screen.getByText("#2")).toBeInTheDocument();
            expect(screen.getByText("#3")).toBeInTheDocument();
        });

        it("handles placeholder members", () => {
            const expensesWithPlaceholder = [
                {
                    id: "exp-1",
                    description: "Groceries",
                    amount: 400,
                    category: "groceries",
                    expense_date: "2024-01-15",
                    paid_by: null,
                    paid_by_placeholder: { id: "ph-1", name: "Mom" },
                    splits: [],
                },
            ];

            render(<TopExpensesList expenses={expensesWithPlaceholder} currency="INR" />);

            expect(screen.getByText("Groceries")).toBeInTheDocument();
            expect(screen.getByText(/Paid by Mom/)).toBeInTheDocument();
        });
    });
});

