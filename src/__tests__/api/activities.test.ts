/**
 * Tests for /api/activities route
 * 
 * Tests the activity feed API endpoint including:
 * - Authentication requirements
 * - Pagination
 * - Filtering by group, category, date range
 * - Search functionality
 */

// Mock next/server BEFORE importing the route
jest.mock("next/server", () => {
    class MockNextResponse {
        status: number;
        headers: Headers;
        private _data: unknown;

        constructor(data: unknown, init?: { status?: number; headers?: HeadersInit }) {
            this._data = data;
            this.status = init?.status || 200;
            this.headers = new Headers(init?.headers);
        }

        async json() {
            return this._data;
        }

        static json(data: unknown, init?: { status?: number; headers?: HeadersInit }) {
            return new MockNextResponse(data, init);
        }
    }

    return {
        NextResponse: MockNextResponse,
        NextRequest: jest.fn(),
    };
});

// Mock Supabase
const mockSupabase = {
    auth: {
        getUser: jest.fn(),
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

// Mock console logger
jest.mock("@/lib/console-logger", () => ({
    apiLog: {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
    },
    log: {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
    },
}));

// Helper to create mock request that works with route builder
import type { NextRequest } from "next/server";

function createMockRequest(url: string): NextRequest {
    const parsedUrl = new URL(url);
    return {
        nextUrl: parsedUrl,
        url: url,
        headers: new Headers(),
        json: jest.fn(),
        text: jest.fn(),
        formData: jest.fn(),
        clone: jest.fn().mockReturnThis(),
    } as unknown as NextRequest;
}

// Import after mocks
import { GET } from "@/app/api/activities/route";

describe("/api/activities", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("GET", () => {
        it("returns 401 when not authenticated", async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: null },
                error: new Error("Not authenticated"),
            });

            const request = createMockRequest("http://localhost:3000/api/activities");
            const response = await GET(request);

            expect(response.status).toBe(401);
        });

        it("returns 200 when user has no groups", async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: { id: "user-1" } },
                error: null,
            });

            mockSupabase.from.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({ data: [], error: null }),
                }),
            });

            const request = createMockRequest("http://localhost:3000/api/activities");
            const response = await GET(request);

            expect(response.status).toBe(200);
            expect(mockSupabase.from).toHaveBeenCalledWith("group_members");
        });

        it("returns paginated activities", async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: { id: "user-1" } },
                error: null,
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
            expect(mockSupabase.from).toHaveBeenCalledWith("activities");
        });

        it("filters by category (entity_type)", async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: { id: "user-1" } },
                error: null,
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
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: { id: "user-1" } },
                error: null,
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
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: { id: "user-1" } },
                error: null,
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
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: { id: "user-1" } },
                error: null,
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
            // range should be called with 0-49 (50 items max, due to transform capping)
            expect(mockActivitiesQuery.range).toHaveBeenCalledWith(0, 49);
        });
    });
});
