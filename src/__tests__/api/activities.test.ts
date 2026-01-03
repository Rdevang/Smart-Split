/**
 * Tests for /api/activities route
 */

// Mock next/server before importing the route
const mockJsonResponse = jest.fn();
jest.mock("next/server", () => ({
    NextResponse: {
        json: (data: unknown, init?: ResponseInit) => {
            const headers = new Headers(init?.headers);
            mockJsonResponse(data, init);
            return {
                status: init?.status || 200,
                headers,
                json: async () => data,
            };
        },
    },
    NextRequest: jest.fn(),
}));

// Mock Supabase
const mockSupabase = {
    auth: {
        getSession: jest.fn(),
    },
    from: jest.fn(),
};

jest.mock("@/lib/supabase/server", () => ({
    createClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

// Mock URL encryption
jest.mock("@/lib/url-ids", () => ({
    encryptUrlId: jest.fn((id: string) => `encrypted_${id}`),
}));

// Helper to create mock request
function createMockRequest(url: string) {
    const parsedUrl = new URL(url);
    return {
        nextUrl: {
            searchParams: parsedUrl.searchParams,
        },
    };
}

// Import after mocks
import { GET } from "@/app/api/activities/route";

describe("/api/activities", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("GET", () => {
        it("returns 401 when not authenticated", async () => {
            mockSupabase.auth.getSession.mockResolvedValue({
                data: { session: null },
            });

            const request = createMockRequest("http://localhost:3000/api/activities");
            const response = await GET(request);

            expect(response.status).toBe(401);
            const data = await response.json();
            expect(data.error).toBe("Unauthorized");
        });

        it("returns empty array when user has no groups", async () => {
            mockSupabase.auth.getSession.mockResolvedValue({
                data: { session: { user: { id: "user-1" } } },
            });

            mockSupabase.from.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({ data: [], error: null }),
                }),
            });

            const request = createMockRequest("http://localhost:3000/api/activities");
            const response = await GET(request);

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.activities).toEqual([]);
            expect(data.totalCount).toBe(0);
            expect(data.hasMore).toBe(false);
        });

        it("returns paginated activities", async () => {
            mockSupabase.auth.getSession.mockResolvedValue({
                data: { session: { user: { id: "user-1" } } },
            });

            const mockActivities = [
                {
                    id: "act-1",
                    entity_type: "expense",
                    action: "created",
                    created_at: "2024-01-01T00:00:00Z",
                    user_profile: { id: "user-1", full_name: "Test User", avatar_url: null },
                    group: { id: "group-1", name: "Test Group" },
                    metadata: { description: "Test expense", amount: 100 },
                },
            ];

            mockSupabase.from.mockImplementation((table: string) => {
                if (table === "group_members") {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockResolvedValue({
                                data: [{ group_id: "group-1" }],
                                error: null,
                            }),
                        }),
                    };
                }
                if (table === "activities") {
                    return {
                        select: jest.fn().mockReturnValue({
                            in: jest.fn().mockReturnValue({
                                order: jest.fn().mockReturnValue({
                                    range: jest.fn().mockResolvedValue({
                                        data: mockActivities,
                                        error: null,
                                        count: 1,
                                    }),
                                }),
                            }),
                        }),
                    };
                }
                return { select: jest.fn() };
            });

            const request = createMockRequest("http://localhost:3000/api/activities?page=1&limit=20");
            const response = await GET(request);

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.activities).toHaveLength(1);
            expect(data.totalCount).toBe(1);
            expect(data.hasMore).toBe(false);
            expect(data.encryptedGroupIds["group-1"]).toBe("encrypted_group-1");
        });

        it("filters by groupId", async () => {
            mockSupabase.auth.getSession.mockResolvedValue({
                data: { session: { user: { id: "user-1" } } },
            });

            const mockMembershipSelect = jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({
                    data: [{ group_id: "group-1" }, { group_id: "group-2" }],
                    error: null,
                }),
            });

            const mockActivitiesQuery = {
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                range: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                    count: 0,
                }),
            };

            mockSupabase.from.mockImplementation((table: string) => {
                if (table === "group_members") {
                    return { select: mockMembershipSelect };
                }
                if (table === "activities") {
                    return {
                        select: jest.fn().mockReturnValue(mockActivitiesQuery),
                    };
                }
                return { select: jest.fn() };
            });

            const request = createMockRequest("http://localhost:3000/api/activities?groupId=group-1");
            const response = await GET(request);

            expect(response.status).toBe(200);
            expect(mockActivitiesQuery.eq).toHaveBeenCalledWith("group_id", "group-1");
        });

        it("returns 404 when filtering by unauthorized group", async () => {
            mockSupabase.auth.getSession.mockResolvedValue({
                data: { session: { user: { id: "user-1" } } },
            });

            mockSupabase.from.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({
                        data: [{ group_id: "group-1" }],
                        error: null,
                    }),
                }),
            });

            const request = createMockRequest("http://localhost:3000/api/activities?groupId=unauthorized-group");
            const response = await GET(request);

            expect(response.status).toBe(404);
            const data = await response.json();
            expect(data.error).toBe("Group not found");
        });

        it("filters by category (entity_type)", async () => {
            mockSupabase.auth.getSession.mockResolvedValue({
                data: { session: { user: { id: "user-1" } } },
            });

            const mockActivitiesQuery = {
                in: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                range: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                    count: 0,
                }),
            };

            mockSupabase.from.mockImplementation((table: string) => {
                if (table === "group_members") {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockResolvedValue({
                                data: [{ group_id: "group-1" }],
                                error: null,
                            }),
                        }),
                    };
                }
                if (table === "activities") {
                    return {
                        select: jest.fn().mockReturnValue(mockActivitiesQuery),
                    };
                }
                return { select: jest.fn() };
            });

            const request = createMockRequest("http://localhost:3000/api/activities?category=expense");
            const response = await GET(request);

            expect(response.status).toBe(200);
            expect(mockActivitiesQuery.eq).toHaveBeenCalledWith("entity_type", "expense");
        });

        it("filters by date range", async () => {
            mockSupabase.auth.getSession.mockResolvedValue({
                data: { session: { user: { id: "user-1" } } },
            });

            const mockActivitiesQuery = {
                in: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                lt: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                range: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                    count: 0,
                }),
            };

            mockSupabase.from.mockImplementation((table: string) => {
                if (table === "group_members") {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockResolvedValue({
                                data: [{ group_id: "group-1" }],
                                error: null,
                            }),
                        }),
                    };
                }
                if (table === "activities") {
                    return {
                        select: jest.fn().mockReturnValue(mockActivitiesQuery),
                    };
                }
                return { select: jest.fn() };
            });

            const request = createMockRequest(
                "http://localhost:3000/api/activities?dateFrom=2024-01-01&dateTo=2024-01-31"
            );
            const response = await GET(request);

            expect(response.status).toBe(200);
            expect(mockActivitiesQuery.gte).toHaveBeenCalledWith("created_at", "2024-01-01");
            expect(mockActivitiesQuery.lt).toHaveBeenCalled();
        });

        it("searches in metadata", async () => {
            mockSupabase.auth.getSession.mockResolvedValue({
                data: { session: { user: { id: "user-1" } } },
            });

            const mockActivitiesQuery = {
                in: jest.fn().mockReturnThis(),
                or: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                range: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                    count: 0,
                }),
            };

            mockSupabase.from.mockImplementation((table: string) => {
                if (table === "group_members") {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockResolvedValue({
                                data: [{ group_id: "group-1" }],
                                error: null,
                            }),
                        }),
                    };
                }
                if (table === "activities") {
                    return {
                        select: jest.fn().mockReturnValue(mockActivitiesQuery),
                    };
                }
                return { select: jest.fn() };
            });

            const request = createMockRequest("http://localhost:3000/api/activities?search=dinner");
            const response = await GET(request);

            expect(response.status).toBe(200);
            expect(mockActivitiesQuery.or).toHaveBeenCalledWith(
                expect.stringContaining("dinner")
            );
        });

        it("limits max page size to 50", async () => {
            mockSupabase.auth.getSession.mockResolvedValue({
                data: { session: { user: { id: "user-1" } } },
            });

            const mockActivitiesQuery = {
                in: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                range: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                    count: 0,
                }),
            };

            mockSupabase.from.mockImplementation((table: string) => {
                if (table === "group_members") {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockResolvedValue({
                                data: [{ group_id: "group-1" }],
                                error: null,
                            }),
                        }),
                    };
                }
                if (table === "activities") {
                    return {
                        select: jest.fn().mockReturnValue(mockActivitiesQuery),
                    };
                }
                return { select: jest.fn() };
            });

            const request = createMockRequest("http://localhost:3000/api/activities?limit=100");
            const response = await GET(request);

            expect(response.status).toBe(200);
            // range should be called with 0-49 (50 items max)
            expect(mockActivitiesQuery.range).toHaveBeenCalledWith(0, 49);
        });
    });
});

