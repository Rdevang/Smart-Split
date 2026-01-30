import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationBell } from "@/components/layout/notification-bell";
import { notificationsService } from "@/services/notifications";
import { ToastProvider } from "@/components/ui/toast";

// Mock the notifications service
jest.mock("@/services/notifications", () => ({
    notificationsService: {
        getNotifications: jest.fn(),
        getPendingInvitations: jest.fn(),
        getUnreadCount: jest.fn(),
        markAsRead: jest.fn(),
        markAllAsRead: jest.fn(),
        deleteNotification: jest.fn(),
        deleteAllRead: jest.fn(),
        acceptInvitation: jest.fn(),
        declineInvitation: jest.fn(),
    },
}));

// Mock Supabase Realtime
const mockSubscribe = jest.fn();
const mockOn = jest.fn();
const mockRemoveChannel = jest.fn();

const mockChannel = {
    on: mockOn.mockReturnThis(),
    subscribe: mockSubscribe.mockImplementation((callback) => {
        // Simulate successful subscription
        if (callback) callback("SUBSCRIBED");
        return mockChannel;
    }),
};

jest.mock("@/lib/supabase/client", () => ({
    createClient: () => ({
        channel: jest.fn().mockReturnValue(mockChannel),
        removeChannel: mockRemoveChannel,
    }),
}));

const mockNotificationsService = notificationsService as jest.Mocked<typeof notificationsService>;

// Test wrapper with ToastProvider
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <ToastProvider>{children}</ToastProvider>
);

const mockNotifications = [
    {
        id: "1",
        user_id: "user-123",
        type: "feedback_response",
        title: "Feedback Response",
        message: "Your feedback has been reviewed",
        data: {},
        is_read: false,
        action_url: "/feedback/history",
        created_at: new Date().toISOString(),
        read_at: null,
    },
    {
        id: "2",
        user_id: "user-123",
        type: "group_activity",
        title: "New expense added",
        message: "John added an expense",
        data: {},
        is_read: true,
        action_url: "/groups/123",
        created_at: new Date(Date.now() - 86400000).toISOString(),
        read_at: new Date().toISOString(),
    },
];

describe("NotificationBell", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();

        // Setup default mock returns
        mockNotificationsService.getNotifications.mockResolvedValue(mockNotifications);
        mockNotificationsService.getPendingInvitations.mockResolvedValue([]);
        mockNotificationsService.getUnreadCount.mockResolvedValue(1);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("renders the bell icon", async () => {
        render(<NotificationBell userId="user-123" />, { wrapper: TestWrapper });

        // Advance timers to trigger initial load
        await act(async () => {
            jest.advanceTimersByTime(0);
        });

        expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("shows unread count badge when there are unread notifications", async () => {
        render(<NotificationBell userId="user-123" />, { wrapper: TestWrapper });

        await act(async () => {
            jest.advanceTimersByTime(0);
        });

        await waitFor(() => {
            expect(screen.getByText("1")).toBeInTheDocument();
        });
    });

    it("opens dropdown when bell is clicked", async () => {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
        render(<NotificationBell userId="user-123" />, { wrapper: TestWrapper });

        await act(async () => {
            jest.advanceTimersByTime(0);
        });

        await user.click(screen.getByRole("button"));

        expect(screen.getByText("Notifications")).toBeInTheDocument();
    });

    it("displays notifications in dropdown", async () => {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
        render(<NotificationBell userId="user-123" />, { wrapper: TestWrapper });

        await act(async () => {
            jest.advanceTimersByTime(0);
        });

        await user.click(screen.getByRole("button"));

        await waitFor(() => {
            expect(screen.getByText("Feedback Response")).toBeInTheDocument();
            expect(screen.getByText("New expense added")).toBeInTheDocument();
        });
    });

    it("shows 'Mark all read' button when there are unread notifications", async () => {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
        render(<NotificationBell userId="user-123" />, { wrapper: TestWrapper });

        await act(async () => {
            jest.advanceTimersByTime(0);
        });

        await user.click(screen.getByRole("button"));

        await waitFor(() => {
            expect(screen.getByText("Mark all read")).toBeInTheDocument();
        });
    });

    it("shows 'Clear read' button when there are read notifications", async () => {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
        render(<NotificationBell userId="user-123" />, { wrapper: TestWrapper });

        await act(async () => {
            jest.advanceTimersByTime(0);
        });

        await user.click(screen.getByRole("button"));

        await waitFor(() => {
            expect(screen.getByText("Clear read")).toBeInTheDocument();
        });
    });

    it("calls markAllAsRead when 'Mark all read' is clicked", async () => {
        mockNotificationsService.markAllAsRead.mockResolvedValue(true);
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

        render(<NotificationBell userId="user-123" />, { wrapper: TestWrapper });

        await act(async () => {
            jest.advanceTimersByTime(0);
        });

        await user.click(screen.getByRole("button"));

        await waitFor(() => {
            expect(screen.getByText("Mark all read")).toBeInTheDocument();
        });

        await user.click(screen.getByText("Mark all read"));

        await waitFor(() => {
            expect(mockNotificationsService.markAllAsRead).toHaveBeenCalledWith("user-123");
        });
    });

    it("calls deleteAllRead when 'Clear read' is clicked", async () => {
        mockNotificationsService.deleteAllRead.mockResolvedValue(true);
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

        render(<NotificationBell userId="user-123" />, { wrapper: TestWrapper });

        await act(async () => {
            jest.advanceTimersByTime(0);
        });

        await user.click(screen.getByRole("button"));

        await waitFor(() => {
            expect(screen.getByText("Clear read")).toBeInTheDocument();
        });

        await user.click(screen.getByText("Clear read"));

        await waitFor(() => {
            expect(mockNotificationsService.deleteAllRead).toHaveBeenCalledWith("user-123");
        });
    });

    it("shows empty state when no notifications", async () => {
        mockNotificationsService.getNotifications.mockResolvedValue([]);
        mockNotificationsService.getUnreadCount.mockResolvedValue(0);

        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
        render(<NotificationBell userId="user-123" />, { wrapper: TestWrapper });

        await act(async () => {
            jest.advanceTimersByTime(0);
        });

        await user.click(screen.getByRole("button"));

        await waitFor(() => {
            expect(screen.getByText("No notifications")).toBeInTheDocument();
        });
    });

    it("marks notification as read when clicked", async () => {
        mockNotificationsService.markAsRead.mockResolvedValue(true);
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

        render(<NotificationBell userId="user-123" />, { wrapper: TestWrapper });

        await act(async () => {
            jest.advanceTimersByTime(0);
        });

        await user.click(screen.getByRole("button"));

        await waitFor(() => {
            expect(screen.getByText("Feedback Response")).toBeInTheDocument();
        });

        // Click the unread notification
        await user.click(screen.getByText("Feedback Response"));

        await waitFor(() => {
            expect(mockNotificationsService.markAsRead).toHaveBeenCalledWith("1");
        });
    });

    it("sets up Realtime subscription on mount", async () => {
        render(<NotificationBell userId="user-123" />, { wrapper: TestWrapper });

        await act(async () => {
            jest.advanceTimersByTime(0);
        });

        // Should subscribe to Realtime channel
        expect(mockSubscribe).toHaveBeenCalled();

        // Should set up listeners for notifications and invitations
        // 5 listeners: INSERT/UPDATE/DELETE for notifications + INSERT/UPDATE for invitations
        expect(mockOn).toHaveBeenCalledTimes(5);
    });

    it("cleans up Realtime subscription on unmount", async () => {
        const { unmount } = render(<NotificationBell userId="user-123" />, { wrapper: TestWrapper });

        await act(async () => {
            jest.advanceTimersByTime(0);
        });

        unmount();

        // Should remove the channel on unmount
        expect(mockRemoveChannel).toHaveBeenCalled();
    });

    it("uses backup polling every 5 minutes", async () => {
        render(<NotificationBell userId="user-123" />, { wrapper: TestWrapper });

        // Initial load
        await act(async () => {
            jest.advanceTimersByTime(0);
        });

        // First call should have been made
        expect(mockNotificationsService.getNotifications).toHaveBeenCalledTimes(1);

        // Advance by 5 minutes (backup polling interval)
        await act(async () => {
            jest.advanceTimersByTime(5 * 60 * 1000);
        });

        // Second call should have been made
        expect(mockNotificationsService.getNotifications).toHaveBeenCalledTimes(2);
    });

    it("does not show badge when unread count is 0", async () => {
        mockNotificationsService.getNotifications.mockResolvedValue([
            { ...mockNotifications[1] }, // Only read notification
        ]);
        mockNotificationsService.getUnreadCount.mockResolvedValue(0);

        render(<NotificationBell userId="user-123" />, { wrapper: TestWrapper });

        await act(async () => {
            jest.advanceTimersByTime(0);
        });

        await waitFor(() => {
            expect(screen.queryByText("1")).not.toBeInTheDocument();
        });
    });

    it("shows 9+ when unread count exceeds 9", async () => {
        mockNotificationsService.getUnreadCount.mockResolvedValue(15);

        render(<NotificationBell userId="user-123" />, { wrapper: TestWrapper });

        await act(async () => {
            jest.advanceTimersByTime(0);
        });

        await waitFor(() => {
            expect(screen.getByText("9+")).toBeInTheDocument();
        });
    });

    it("shows connected state by default", async () => {
        render(<NotificationBell userId="user-123" />, { wrapper: TestWrapper });

        await act(async () => {
            jest.advanceTimersByTime(0);
        });

        // No offline indicator should be visible
        const button = screen.getByRole("button");
        expect(button).toBeInTheDocument();
        // The WifiOff icon (offline indicator) should not be in the button
        expect(screen.queryByTitle("Reconnecting...")).not.toBeInTheDocument();
    });

    it("shows offline indicator when connection fails", async () => {
        // Override mock to simulate connection failure
        mockSubscribe.mockImplementationOnce((callback) => {
            if (callback) callback("CHANNEL_ERROR");
            return mockChannel;
        });

        render(<NotificationBell userId="user-123" />, { wrapper: TestWrapper });

        await act(async () => {
            jest.advanceTimersByTime(0);
        });

        // The offline indicator should appear
        await waitFor(() => {
            expect(screen.getByTitle("Reconnecting...")).toBeInTheDocument();
        });
    });

    it("shows offline text in dropdown header when disconnected", async () => {
        // Override mock to simulate connection failure
        mockSubscribe.mockImplementationOnce((callback) => {
            if (callback) callback("TIMED_OUT");
            return mockChannel;
        });

        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
        render(<NotificationBell userId="user-123" />, { wrapper: TestWrapper });

        await act(async () => {
            jest.advanceTimersByTime(0);
        });

        await user.click(screen.getByRole("button"));

        await waitFor(() => {
            expect(screen.getByText("Offline")).toBeInTheDocument();
        });
    });
});
