/**
 * Tests for ActivityPageClient component
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActivityPageClient } from "@/components/features/activity/activity-page-client";
import type { ActivityWithDetails } from "@/services/activities.server";

// Mock fetch
global.fetch = jest.fn();

// Mock date-fns to avoid hydration issues
jest.mock("date-fns", () => ({
    formatDistanceToNow: jest.fn(() => "about 1 hour ago"),
}));

describe("ActivityPageClient", () => {
    const mockActivity: ActivityWithDetails = {
        id: "act-1",
        user_id: "user-1",
        group_id: "group-1",
        entity_type: "expense",
        entity_id: "exp-1",
        action: "created",
        metadata: { description: "Dinner", amount: 50 },
        created_at: new Date().toISOString(),
        user_profile: {
            id: "user-1",
            full_name: "Test User",
            avatar_url: null,
        },
        group: {
            id: "group-1",
            name: "Test Group",
        },
    };

    const defaultProps = {
        initialActivities: [mockActivity],
        initialEncryptedGroupIds: { "group-1": "encrypted_group-1" },
        initialTotalCount: 25,
        initialHasMore: true,
        groups: [{ id: "group-1", name: "Test Group" }],
        members: [{ id: "user-1", name: "Test User" }],
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (global.fetch as jest.Mock).mockReset();
    });

    it("renders initial activities", () => {
        render(<ActivityPageClient {...defaultProps} />);

        expect(screen.getByText(/Test User added "Dinner"/)).toBeInTheDocument();
        expect(screen.getByText("Test Group")).toBeInTheDocument();
    });

    it("shows activity count", () => {
        render(<ActivityPageClient {...defaultProps} />);

        expect(screen.getByText(/Showing 1 of 25 activities/)).toBeInTheDocument();
    });

    it("shows Show More button when hasMore is true", () => {
        render(<ActivityPageClient {...defaultProps} />);

        expect(screen.getByRole("button", { name: /show more/i })).toBeInTheDocument();
        expect(screen.getByText(/24 remaining/)).toBeInTheDocument();
    });

    it("does not show Show More button when hasMore is false", () => {
        render(
            <ActivityPageClient
                {...defaultProps}
                initialHasMore={false}
                initialTotalCount={1}
            />
        );

        expect(screen.queryByRole("button", { name: /show more/i })).not.toBeInTheDocument();
        expect(screen.getByText(/You've reached the end/)).toBeInTheDocument();
    });

    it("loads more activities when Show More is clicked", async () => {
        const user = userEvent.setup();

        const moreActivities: ActivityWithDetails[] = [
            {
                ...mockActivity,
                id: "act-2",
                metadata: { description: "Lunch", amount: 30 },
            },
        ];

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                activities: moreActivities,
                totalCount: 25,
                page: 2,
                limit: 20,
                hasMore: true,
                encryptedGroupIds: { "group-1": "encrypted_group-1" },
            }),
        });

        render(<ActivityPageClient {...defaultProps} />);

        await user.click(screen.getByRole("button", { name: /show more/i }));

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining("/api/activities?page=2")
            );
        });
    });

    it("shows loading state when loading more", async () => {
        const user = userEvent.setup();

        // Make fetch hang
        (global.fetch as jest.Mock).mockImplementation(
            () => new Promise(() => {}) // Never resolves
        );

        render(<ActivityPageClient {...defaultProps} />);

        await user.click(screen.getByRole("button", { name: /show more/i }));

        await waitFor(() => {
            expect(screen.getByText(/Loading.../)).toBeInTheDocument();
        });
    });

    it("renders filters component", () => {
        render(<ActivityPageClient {...defaultProps} />);

        expect(screen.getByPlaceholderText("Search activities...")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /filters/i })).toBeInTheDocument();
    });

    it("fetches filtered activities when filters change", async () => {
        const user = userEvent.setup();

        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({
                activities: [],
                totalCount: 0,
                page: 1,
                limit: 20,
                hasMore: false,
                encryptedGroupIds: {},
            }),
        });

        render(<ActivityPageClient {...defaultProps} />);

        // Open filters
        await user.click(screen.getByRole("button", { name: /filters/i }));

        // Select a group filter
        const groupSelect = screen.getAllByRole("combobox")[0];
        await user.selectOptions(groupSelect, "group-1");

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining("groupId=group-1")
            );
        });
    });

    it("resets to page 1 when filters change", async () => {
        const user = userEvent.setup();

        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({
                activities: [],
                totalCount: 0,
                page: 1,
                limit: 20,
                hasMore: false,
                encryptedGroupIds: {},
            }),
        });

        render(<ActivityPageClient {...defaultProps} />);

        // Open filters
        await user.click(screen.getByRole("button", { name: /filters/i }));

        // Select a category filter
        const categorySelect = screen.getAllByRole("combobox")[2];
        await user.selectOptions(categorySelect, "expense");

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining("page=1")
            );
        });
    });

    it("shows empty state when no activities match filters", async () => {
        const user = userEvent.setup();

        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({
                activities: [],
                totalCount: 0,
                page: 1,
                limit: 20,
                hasMore: false,
                encryptedGroupIds: {},
            }),
        });

        render(<ActivityPageClient {...defaultProps} />);

        // Open filters and select category
        await user.click(screen.getByRole("button", { name: /filters/i }));
        const categorySelect = screen.getAllByRole("combobox")[2];
        await user.selectOptions(categorySelect, "settlement");

        await waitFor(() => {
            expect(screen.getByText(/No activity yet/)).toBeInTheDocument();
        });
    });

    it("handles fetch error gracefully", async () => {
        const user = userEvent.setup();
        const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        (global.fetch as jest.Mock).mockResolvedValue({
            ok: false,
            status: 500,
        });

        render(<ActivityPageClient {...defaultProps} />);

        await user.click(screen.getByRole("button", { name: /show more/i }));

        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalledWith(
                "Error fetching activities:",
                expect.any(Error)
            );
        });

        consoleSpy.mockRestore();
    });

    it("appends activities when loading more", async () => {
        const user = userEvent.setup();

        const moreActivities: ActivityWithDetails[] = [
            {
                ...mockActivity,
                id: "act-2",
                metadata: { description: "Lunch", amount: 30 },
            },
        ];

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                activities: moreActivities,
                totalCount: 25,
                page: 2,
                limit: 20,
                hasMore: false,
                encryptedGroupIds: { "group-1": "encrypted_group-1" },
            }),
        });

        render(<ActivityPageClient {...defaultProps} />);

        // Initial activity should be there
        expect(screen.getByText(/Test User added "Dinner"/)).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /show more/i }));

        await waitFor(() => {
            // Should now show both activities
            expect(screen.getByText(/Test User added "Dinner"/)).toBeInTheDocument();
            expect(screen.getByText(/Test User added "Lunch"/)).toBeInTheDocument();
        });
    });

    it("updates remaining count when loading more", async () => {
        const user = userEvent.setup();

        const moreActivities: ActivityWithDetails[] = [
            {
                ...mockActivity,
                id: "act-2",
                metadata: { description: "Lunch", amount: 30 },
            },
        ];

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                activities: moreActivities,
                totalCount: 25,
                page: 2,
                limit: 20,
                hasMore: true,
                encryptedGroupIds: { "group-1": "encrypted_group-1" },
            }),
        });

        render(<ActivityPageClient {...defaultProps} />);

        // Initially showing "24 remaining"
        expect(screen.getByText(/24 remaining/)).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /show more/i }));

        await waitFor(() => {
            // After loading 1 more, should show "23 remaining"
            expect(screen.getByText(/23 remaining/)).toBeInTheDocument();
        });
    });
});

