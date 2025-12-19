import { notificationsService } from "@/services/notifications";

// Mock result that can be set per test
let mockResult: unknown = { data: null, error: null };

jest.mock("@/lib/supabase/client", () => ({
    createClient: () => ({
        from: jest.fn(() => {
            const chain: Record<string, unknown> = {};
            const methods = ["select", "insert", "update", "delete", "eq", "order", "limit", "single"];
            
            methods.forEach(method => {
                chain[method] = jest.fn(() => {
                    // Return promise with mockResult for terminal operations
                    const proxyChain = new Proxy(chain, {
                        get(target, prop) {
                            if (prop === "then") {
                                return (resolve: (value: unknown) => void) => resolve(mockResult);
                            }
                            return target[prop as string];
                        }
                    });
                    return proxyChain;
                });
            });
            
            return chain;
        }),
    }),
}));

// Helper to set mock result
const setMockResult = (result: unknown) => {
    mockResult = result;
};

describe("notificationsService", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        setMockResult({ data: null, error: null });
    });

    describe("getNotifications", () => {
        it("should fetch notifications for a user", async () => {
            const mockNotifications = [
                { id: "1", title: "Test", is_read: false },
                { id: "2", title: "Test 2", is_read: true },
            ];
            setMockResult({ data: mockNotifications, error: null });

            const result = await notificationsService.getNotifications("user-123", 10);

            expect(result).toEqual(mockNotifications);
        });

        it("should return empty array on error", async () => {
            setMockResult({ data: null, error: { message: "Error" } });

            const result = await notificationsService.getNotifications("user-123");

            expect(result).toEqual([]);
        });
    });

    describe("getUnreadCount", () => {
        it("should return count of unread notifications", async () => {
            setMockResult({ count: 5, error: null });

            const result = await notificationsService.getUnreadCount("user-123");

            expect(result).toBe(5);
        });

        it("should return 0 on error", async () => {
            setMockResult({ count: null, error: { message: "Error" } });

            const result = await notificationsService.getUnreadCount("user-123");

            expect(result).toBe(0);
        });
    });

    describe("markAsRead", () => {
        it("should mark a notification as read", async () => {
            setMockResult({ error: null });

            const result = await notificationsService.markAsRead("notif-123");

            expect(result).toBe(true);
        });

        it("should return false on error", async () => {
            setMockResult({ error: { message: "Error" } });

            const result = await notificationsService.markAsRead("notif-123");

            expect(result).toBe(false);
        });
    });

    describe("markAllAsRead", () => {
        it("should mark all notifications as read for a user", async () => {
            setMockResult({ error: null });

            const result = await notificationsService.markAllAsRead("user-123");

            expect(result).toBe(true);
        });

        it("should return false on error", async () => {
            setMockResult({ error: { message: "Error" } });

            const result = await notificationsService.markAllAsRead("user-123");

            expect(result).toBe(false);
        });
    });

    describe("deleteNotification", () => {
        it("should delete a notification", async () => {
            setMockResult({ error: null });

            const result = await notificationsService.deleteNotification("notif-123");

            expect(result).toBe(true);
        });

        it("should return false on error", async () => {
            setMockResult({ error: { message: "Error" } });

            const result = await notificationsService.deleteNotification("notif-123");

            expect(result).toBe(false);
        });
    });

    describe("deleteAllRead", () => {
        it("should delete all read notifications for a user", async () => {
            setMockResult({ error: null });

            const result = await notificationsService.deleteAllRead("user-123");

            expect(result).toBe(true);
        });

        it("should return false on error", async () => {
            setMockResult({ error: { message: "Error" } });

            const result = await notificationsService.deleteAllRead("user-123");

            expect(result).toBe(false);
        });
    });

    describe("createNotification", () => {
        it("should create a notification", async () => {
            setMockResult({ error: null });

            const result = await notificationsService.createNotification({
                user_id: "user-123",
                type: "test",
                title: "Test Notification",
                message: "This is a test",
            });

            expect(result).toBe(true);
        });

        it("should return false on error", async () => {
            setMockResult({ error: { message: "Error" } });

            const result = await notificationsService.createNotification({
                user_id: "user-123",
                type: "test",
                title: "Test Notification",
            });

            expect(result).toBe(false);
        });
    });
});

