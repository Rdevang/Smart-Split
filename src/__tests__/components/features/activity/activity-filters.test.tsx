/**
 * Tests for ActivityFilters component
 */

import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActivityFilters, type ActivityFiltersState } from "@/components/features/activity/activity-filters";

describe("ActivityFilters", () => {
    const defaultFilters: ActivityFiltersState = {
        search: "",
        groupId: "",
        memberId: "",
        category: "",
        dateFrom: "",
        dateTo: "",
    };

    const mockGroups = [
        { id: "group-1", name: "Trip to Paris" },
        { id: "group-2", name: "Roommates" },
    ];

    const mockMembers = [
        { id: "member-1", name: "Alice" },
        { id: "member-2", name: "Bob" },
    ];

    const mockOnFiltersChange = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("renders search input", () => {
        render(
            <ActivityFilters
                filters={defaultFilters}
                onFiltersChange={mockOnFiltersChange}
                groups={mockGroups}
                members={mockMembers}
            />
        );

        expect(screen.getByPlaceholderText("Search activities...")).toBeInTheDocument();
    });

    it("renders filters button", () => {
        render(
            <ActivityFilters
                filters={defaultFilters}
                onFiltersChange={mockOnFiltersChange}
                groups={mockGroups}
                members={mockMembers}
            />
        );

        expect(screen.getByRole("button", { name: /filters/i })).toBeInTheDocument();
    });

    it("toggles filter panel when filters button is clicked", async () => {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

        render(
            <ActivityFilters
                filters={defaultFilters}
                onFiltersChange={mockOnFiltersChange}
                groups={mockGroups}
                members={mockMembers}
            />
        );

        // Filter panel should be hidden initially
        expect(screen.queryByText("Group")).not.toBeInTheDocument();

        // Click filters button
        await user.click(screen.getByRole("button", { name: /filters/i }));

        // Filter panel should be visible
        expect(screen.getByText("Group")).toBeInTheDocument();
        expect(screen.getByText("Member")).toBeInTheDocument();
        expect(screen.getByText("Category")).toBeInTheDocument();
        expect(screen.getByText("Date Range")).toBeInTheDocument();
    });

    it("debounces search input (300ms)", async () => {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

        render(
            <ActivityFilters
                filters={defaultFilters}
                onFiltersChange={mockOnFiltersChange}
                groups={mockGroups}
                members={mockMembers}
            />
        );

        const searchInput = screen.getByPlaceholderText("Search activities...");

        // Type in search
        await user.type(searchInput, "dinner");

        // Should not call onFiltersChange immediately
        expect(mockOnFiltersChange).not.toHaveBeenCalled();

        // Advance timers by 300ms (debounce time)
        act(() => {
            jest.advanceTimersByTime(300);
        });

        // Now it should be called
        await waitFor(() => {
            expect(mockOnFiltersChange).toHaveBeenCalledWith(
                expect.objectContaining({ search: "dinner" })
            );
        });
    });

    it("clears search when X button is clicked", async () => {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

        render(
            <ActivityFilters
                filters={{ ...defaultFilters, search: "test" }}
                onFiltersChange={mockOnFiltersChange}
                groups={mockGroups}
                members={mockMembers}
            />
        );

        // Find and click the clear button (X)
        const searchInput = screen.getByPlaceholderText("Search activities...");
        await user.clear(searchInput);

        act(() => {
            jest.advanceTimersByTime(300);
        });

        await waitFor(() => {
            expect(mockOnFiltersChange).toHaveBeenCalledWith(
                expect.objectContaining({ search: "" })
            );
        });
    });

    it("shows active filter count badge", async () => {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

        render(
            <ActivityFilters
                filters={{ ...defaultFilters, groupId: "group-1", category: "expense" }}
                onFiltersChange={mockOnFiltersChange}
                groups={mockGroups}
                members={mockMembers}
            />
        );

        // Should show badge with count 2 (groupId + category)
        expect(screen.getByText("2")).toBeInTheDocument();
    });

    it("calls onFiltersChange when group filter changes", async () => {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

        render(
            <ActivityFilters
                filters={defaultFilters}
                onFiltersChange={mockOnFiltersChange}
                groups={mockGroups}
                members={mockMembers}
            />
        );

        // Open filters
        await user.click(screen.getByRole("button", { name: /filters/i }));

        // Find and change group select
        const groupSelect = screen.getAllByRole("combobox")[0];
        await user.selectOptions(groupSelect, "group-1");

        expect(mockOnFiltersChange).toHaveBeenCalledWith(
            expect.objectContaining({ groupId: "group-1" })
        );
    });

    it("calls onFiltersChange when category filter changes", async () => {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

        render(
            <ActivityFilters
                filters={defaultFilters}
                onFiltersChange={mockOnFiltersChange}
                groups={mockGroups}
                members={mockMembers}
            />
        );

        // Open filters
        await user.click(screen.getByRole("button", { name: /filters/i }));

        // Find category select (3rd select)
        const categorySelect = screen.getAllByRole("combobox")[2];
        await user.selectOptions(categorySelect, "expense");

        expect(mockOnFiltersChange).toHaveBeenCalledWith(
            expect.objectContaining({ category: "expense" })
        );
    });

    it("clears all filters when clear button is clicked", async () => {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

        render(
            <ActivityFilters
                filters={{ ...defaultFilters, groupId: "group-1", search: "test" }}
                onFiltersChange={mockOnFiltersChange}
                groups={mockGroups}
                members={mockMembers}
            />
        );

        // Open filters
        await user.click(screen.getByRole("button", { name: /filters/i }));

        // Click clear all filters
        const clearButton = screen.getByRole("button", { name: /clear all filters/i });
        await user.click(clearButton);

        expect(mockOnFiltersChange).toHaveBeenCalledWith({
            search: "",
            groupId: "",
            memberId: "",
            category: "",
            dateFrom: "",
            dateTo: "",
        });
    });

    it("keeps search input enabled during loading for better UX", () => {
        render(
            <ActivityFilters
                filters={defaultFilters}
                onFiltersChange={mockOnFiltersChange}
                groups={mockGroups}
                members={mockMembers}
                isLoading={true}
            />
        );

        // Search input stays enabled so users can keep typing while results load
        const searchInput = screen.getByPlaceholderText("Search activities...");
        expect(searchInput).not.toBeDisabled();
    });

    it("renders all category options", async () => {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

        render(
            <ActivityFilters
                filters={defaultFilters}
                onFiltersChange={mockOnFiltersChange}
                groups={mockGroups}
                members={mockMembers}
            />
        );

        // Open filters
        await user.click(screen.getByRole("button", { name: /filters/i }));

        // Check category options exist
        const categorySelect = screen.getAllByRole("combobox")[2];
        const options = categorySelect.querySelectorAll("option");

        const optionValues = Array.from(options).map((opt) => opt.value);
        expect(optionValues).toContain("");
        expect(optionValues).toContain("expense");
        expect(optionValues).toContain("settlement");
        expect(optionValues).toContain("member");
        expect(optionValues).toContain("group");
    });

    it("renders group options from props", async () => {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

        render(
            <ActivityFilters
                filters={defaultFilters}
                onFiltersChange={mockOnFiltersChange}
                groups={mockGroups}
                members={mockMembers}
            />
        );

        // Open filters
        await user.click(screen.getByRole("button", { name: /filters/i }));

        // Check group options
        const groupSelect = screen.getAllByRole("combobox")[0];
        expect(groupSelect).toContainHTML("Trip to Paris");
        expect(groupSelect).toContainHTML("Roommates");
    });

    it("renders member options from props", async () => {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

        render(
            <ActivityFilters
                filters={defaultFilters}
                onFiltersChange={mockOnFiltersChange}
                groups={mockGroups}
                members={mockMembers}
            />
        );

        // Open filters
        await user.click(screen.getByRole("button", { name: /filters/i }));

        // Check member options
        const memberSelect = screen.getAllByRole("combobox")[1];
        expect(memberSelect).toContainHTML("Alice");
        expect(memberSelect).toContainHTML("Bob");
    });
});

