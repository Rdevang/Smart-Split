/**
 * Tests for /api/health endpoint
 * 
 * This endpoint provides general health check for monitoring services
 * and includes graceful degradation headers for CDN caching.
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
import { GET } from "@/app/api/health/route";

const mockGetRedis = getRedis as jest.MockedFunction<typeof getRedis>;

describe("GET /api/health", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("when Redis is healthy", () => {
        beforeEach(() => {
            mockGetRedis.mockReturnValue({
                ping: jest.fn().mockResolvedValue("PONG"),
            } as unknown as ReturnType<typeof getRedis>);
        });

        it("returns healthy status with 200", async () => {
            const response = await GET();
            const data = await response.json();
            
            expect(response.status).toBe(200);
            expect(data.status).toBe("healthy");
        });

        it("returns healthy cache check", async () => {
            const response = await GET();
            const data = await response.json();
            
            expect(data.checks.cache).toBe("healthy");
        });

        it("includes version and environment", async () => {
            const response = await GET();
            const data = await response.json();
            
            expect(data).toHaveProperty("version");
            expect(data).toHaveProperty("environment");
        });

        it("includes timestamp", async () => {
            const response = await GET();
            const data = await response.json();
            
            expect(data).toHaveProperty("timestamp");
            expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
        });

        it("includes response time", async () => {
            const response = await GET();
            const data = await response.json();
            
            expect(data).toHaveProperty("responseTime");
            expect(data.responseTime).toMatch(/^\d+ms$/);
        });
    });

    describe("when Redis is not configured", () => {
        beforeEach(() => {
            mockGetRedis.mockReturnValue(null);
        });

        it("returns degraded status with 200", async () => {
            const response = await GET();
            const data = await response.json();
            
            expect(response.status).toBe(200);
            expect(data.status).toBe("degraded");
        });

        it("marks cache as degraded (not unhealthy)", async () => {
            const response = await GET();
            const data = await response.json();
            
            expect(data.checks.cache).toBe("degraded");
        });
    });

    describe("when Redis ping fails", () => {
        beforeEach(() => {
            mockGetRedis.mockReturnValue({
                ping: jest.fn().mockRejectedValue(new Error("Connection refused")),
            } as unknown as ReturnType<typeof getRedis>);
        });

        it("returns unhealthy status with 503", async () => {
            const response = await GET();
            const data = await response.json();
            
            expect(response.status).toBe(503);
            expect(data.status).toBe("unhealthy");
        });

        it("marks cache as unhealthy", async () => {
            const response = await GET();
            const data = await response.json();
            
            expect(data.checks.cache).toBe("unhealthy");
        });
    });

    describe("cache headers (graceful degradation)", () => {
        beforeEach(() => {
            mockGetRedis.mockReturnValue(null);
        });

        it("includes Cache-Control header with stale-if-error", async () => {
            const response = await GET();
            const cacheControl = response.headers.get("Cache-Control");
            
            expect(cacheControl).toContain("public");
            expect(cacheControl).toContain("stale-if-error");
        });

        it("includes stale-while-revalidate directive", async () => {
            const response = await GET();
            const cacheControl = response.headers.get("Cache-Control");
            
            expect(cacheControl).toContain("stale-while-revalidate");
        });

        it("includes Vary header", async () => {
            const response = await GET();
            const vary = response.headers.get("Vary");
            
            expect(vary).toBe("Accept-Encoding");
        });

        it("uses public-dynamic cache profile", async () => {
            const response = await GET();
            const cacheControl = response.headers.get("Cache-Control");
            
            // public-dynamic: s-maxage=60, stale-while-revalidate=300, stale-if-error=86400
            expect(cacheControl).toContain("s-maxage=60");
            expect(cacheControl).toContain("stale-while-revalidate=300");
            expect(cacheControl).toContain("stale-if-error=86400");
        });

        it("includes cache headers even on error responses", async () => {
            mockGetRedis.mockReturnValue({
                ping: jest.fn().mockRejectedValue(new Error("Failed")),
            } as unknown as ReturnType<typeof getRedis>);

            const response = await GET();
            const cacheControl = response.headers.get("Cache-Control");
            
            expect(response.status).toBe(503);
            expect(cacheControl).toContain("stale-if-error");
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

        it("has expected shape", async () => {
            const response = await GET();
            const data = await response.json();
            
            expect(data).toMatchObject({
                status: expect.stringMatching(/^(healthy|degraded|unhealthy)$/),
                version: expect.any(String),
                environment: expect.any(String),
                checks: expect.any(Object),
                responseTime: expect.stringMatching(/^\d+ms$/),
                timestamp: expect.any(String),
            });
        });
    });
});

