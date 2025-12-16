/**
 * Tests for /api/cache/health endpoint
 * 
 * This endpoint tests Redis connectivity with write/read/delete operations
 * and includes graceful degradation headers.
 */

import { getRedis } from "@/lib/redis";

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
}));

// Mock the redis module
jest.mock("@/lib/redis", () => ({
    getRedis: jest.fn(),
}));

// Import after mocks
import { GET } from "@/app/api/cache/health/route";

const mockGetRedis = getRedis as jest.MockedFunction<typeof getRedis>;

describe("GET /api/cache/health", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("when Redis is not configured", () => {
        beforeEach(() => {
            mockGetRedis.mockReturnValue(null);
        });

        it("returns not_configured status with 200", async () => {
            const response = await GET();
            const data = await response.json();
            
            expect(response.status).toBe(200);
            expect(data.status).toBe("not_configured");
        });

        it("returns helpful message about env vars", async () => {
            const response = await GET();
            const data = await response.json();
            
            expect(data.message).toContain("UPSTASH_REDIS_REST_URL");
            expect(data.message).toContain("UPSTASH_REDIS_REST_TOKEN");
        });

        it("indicates caching is disabled", async () => {
            const response = await GET();
            const data = await response.json();
            
            expect(data.caching).toBe(false);
        });

        it("includes timestamp", async () => {
            const response = await GET();
            const data = await response.json();
            
            expect(data).toHaveProperty("timestamp");
        });
    });

    describe("when Redis is healthy", () => {
        let mockSet: jest.Mock;
        let mockGet: jest.Mock;
        let mockDel: jest.Mock;

        beforeEach(() => {
            mockSet = jest.fn().mockResolvedValue("OK");
            mockGet = jest.fn().mockImplementation(async () => {
                // Return the same value that was set
                const setCall = mockSet.mock.calls[0];
                return setCall ? setCall[1] : null;
            });
            mockDel = jest.fn().mockResolvedValue(1);

            mockGetRedis.mockReturnValue({
                set: mockSet,
                get: mockGet,
                del: mockDel,
            } as unknown as ReturnType<typeof getRedis>);
        });

        it("returns healthy status with 200", async () => {
            const response = await GET();
            const data = await response.json();
            
            expect(response.status).toBe(200);
            expect(data.status).toBe("healthy");
        });

        it("indicates caching is enabled", async () => {
            const response = await GET();
            const data = await response.json();
            
            expect(data.caching).toBe(true);
        });

        it("shows success for all test operations", async () => {
            const response = await GET();
            const data = await response.json();
            
            expect(data.test.write).toContain("Success");
            expect(data.test.read).toContain("Success");
            expect(data.test.delete).toContain("Success");
        });

        it("performs write operation with test key", async () => {
            await GET();
            
            expect(mockSet).toHaveBeenCalledWith(
                "health:check",
                expect.stringMatching(/^ping-\d+$/),
                { ex: 60 }
            );
        });

        it("performs read operation for test key", async () => {
            await GET();
            
            expect(mockGet).toHaveBeenCalledWith("health:check");
        });

        it("cleans up test key after check", async () => {
            await GET();
            
            expect(mockDel).toHaveBeenCalledWith("health:check");
        });
    });

    describe("when Redis read/write mismatch", () => {
        beforeEach(() => {
            mockGetRedis.mockReturnValue({
                set: jest.fn().mockResolvedValue("OK"),
                get: jest.fn().mockResolvedValue("wrong-value"),
                del: jest.fn().mockResolvedValue(1),
            } as unknown as ReturnType<typeof getRedis>);
        });

        it("returns error status with 500", async () => {
            const response = await GET();
            const data = await response.json();
            
            expect(response.status).toBe(500);
            expect(data.status).toBe("error");
        });

        it("indicates read/write mismatch", async () => {
            const response = await GET();
            const data = await response.json();
            
            expect(data.message).toContain("mismatch");
        });

        it("indicates caching is not working", async () => {
            const response = await GET();
            const data = await response.json();
            
            expect(data.caching).toBe(false);
        });
    });

    describe("when Redis operation fails", () => {
        beforeEach(() => {
            mockGetRedis.mockReturnValue({
                set: jest.fn().mockRejectedValue(new Error("Connection timeout")),
                get: jest.fn(),
                del: jest.fn(),
            } as unknown as ReturnType<typeof getRedis>);
        });

        it("returns error status with 500", async () => {
            const response = await GET();
            const data = await response.json();
            
            expect(response.status).toBe(500);
            expect(data.status).toBe("error");
        });

        it("returns the error message", async () => {
            const response = await GET();
            const data = await response.json();
            
            expect(data.message).toBe("Connection timeout");
        });

        it("indicates caching is not working", async () => {
            const response = await GET();
            const data = await response.json();
            
            expect(data.caching).toBe(false);
        });
    });

    describe("cache headers (graceful degradation)", () => {
        beforeEach(() => {
            mockGetRedis.mockReturnValue(null);
        });

        it("includes Cache-Control with stale-if-error", async () => {
            const response = await GET();
            const cacheControl = response.headers.get("Cache-Control");
            
            expect(cacheControl).toContain("stale-if-error");
        });

        it("uses public-dynamic cache profile", async () => {
            const response = await GET();
            const cacheControl = response.headers.get("Cache-Control");
            
            expect(cacheControl).toContain("public");
            expect(cacheControl).toContain("s-maxage=60");
            expect(cacheControl).toContain("stale-while-revalidate=300");
            expect(cacheControl).toContain("stale-if-error=86400");
        });

        it("includes Vary header", async () => {
            const response = await GET();
            
            expect(response.headers.get("Vary")).toBe("Accept-Encoding");
        });

        it("includes cache headers on success response", async () => {
            mockGetRedis.mockReturnValue({
                set: jest.fn().mockResolvedValue("OK"),
                get: jest.fn().mockImplementation(async function(this: { set: jest.Mock }) {
                    return this.set.mock.calls[0]?.[1];
                }),
                del: jest.fn().mockResolvedValue(1),
            } as unknown as ReturnType<typeof getRedis>);

            // Fix: Mock get to return the set value
            const mockSet = jest.fn().mockResolvedValue("OK");
            let setValue: string | null = null;
            mockSet.mockImplementation((key, value) => {
                setValue = value;
                return Promise.resolve("OK");
            });
            
            mockGetRedis.mockReturnValue({
                set: mockSet,
                get: jest.fn().mockImplementation(() => Promise.resolve(setValue)),
                del: jest.fn().mockResolvedValue(1),
            } as unknown as ReturnType<typeof getRedis>);

            const response = await GET();
            
            expect(response.status).toBe(200);
            expect(response.headers.get("Cache-Control")).toContain("stale-if-error");
        });

        it("includes cache headers on error response", async () => {
            mockGetRedis.mockReturnValue({
                set: jest.fn().mockRejectedValue(new Error("Failed")),
                get: jest.fn(),
                del: jest.fn(),
            } as unknown as ReturnType<typeof getRedis>);

            const response = await GET();
            
            expect(response.status).toBe(500);
            expect(response.headers.get("Cache-Control")).toContain("stale-if-error");
        });
    });

    describe("response format", () => {
        beforeEach(() => {
            mockGetRedis.mockReturnValue(null);
        });

        it("returns parseable JSON response", async () => {
            const response = await GET();
            
            // Should not throw when parsing
            const data = await response.json();
            expect(data).toBeDefined();
            expect(typeof data).toBe("object");
        });

        it("always includes timestamp", async () => {
            const response = await GET();
            const data = await response.json();
            
            expect(data).toHaveProperty("timestamp");
            expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
        });

        it("always includes status field", async () => {
            const response = await GET();
            const data = await response.json();
            
            expect(data).toHaveProperty("status");
            expect(["healthy", "not_configured", "error"]).toContain(data.status);
        });

        it("always includes caching field", async () => {
            const response = await GET();
            const data = await response.json();
            
            expect(data).toHaveProperty("caching");
            expect(typeof data.caching).toBe("boolean");
        });
    });
});

