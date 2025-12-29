import { checkAIUsage, incrementAIUsage, getAIUsageStats } from "@/lib/ai-rate-limit";
import { getRedis } from "@/lib/redis";

// Mock Redis
jest.mock("@/lib/redis", () => ({
    getRedis: jest.fn(),
}));

const mockGetRedis = getRedis as jest.MockedFunction<typeof getRedis>;

describe("AI Rate Limit", () => {
    const userId = "user-123";
    let mockRedis: {
        get: jest.Mock;
        incr: jest.Mock;
        expire: jest.Mock;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockRedis = {
            get: jest.fn(),
            incr: jest.fn(),
            expire: jest.fn(),
        };
    });

    describe("checkAIUsage", () => {
        it("should allow request when Redis is unavailable (fail open)", async () => {
            mockGetRedis.mockReturnValue(null);

            const result = await checkAIUsage(userId);

            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(1);
            expect(result.used).toBe(0);
            expect(result.limit).toBe(1);
            expect(result.resetAt).toBeInstanceOf(Date);
        });

        it("should allow request when user has no usage", async () => {
            mockGetRedis.mockReturnValue(mockRedis as unknown as ReturnType<typeof getRedis>);
            mockRedis.get.mockResolvedValue(0);

            const result = await checkAIUsage(userId);

            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(1);
            expect(result.used).toBe(0);
        });

        it("should deny request when user has reached limit", async () => {
            mockGetRedis.mockReturnValue(mockRedis as unknown as ReturnType<typeof getRedis>);
            mockRedis.get.mockResolvedValue(1);

            const result = await checkAIUsage(userId);

            expect(result.allowed).toBe(false);
            expect(result.remaining).toBe(0);
            expect(result.used).toBe(1);
        });

        it("should handle null usage as 0", async () => {
            mockGetRedis.mockReturnValue(mockRedis as unknown as ReturnType<typeof getRedis>);
            mockRedis.get.mockResolvedValue(null);

            const result = await checkAIUsage(userId);

            expect(result.allowed).toBe(true);
            expect(result.used).toBe(0);
        });

        it("should fail open on Redis error", async () => {
            mockGetRedis.mockReturnValue(mockRedis as unknown as ReturnType<typeof getRedis>);
            mockRedis.get.mockRejectedValue(new Error("Redis error"));

            const result = await checkAIUsage(userId);

            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(1);
        });

        it("should calculate correct reset time (next midnight UTC)", async () => {
            mockGetRedis.mockReturnValue(null);

            const result = await checkAIUsage(userId);

            const tomorrow = new Date();
            tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
            tomorrow.setUTCHours(0, 0, 0, 0);

            expect(result.resetAt.getTime()).toBe(tomorrow.getTime());
        });
    });

    describe("incrementAIUsage", () => {
        it("should do nothing when Redis is unavailable", async () => {
            mockGetRedis.mockReturnValue(null);

            await incrementAIUsage(userId);

            expect(mockRedis.incr).not.toHaveBeenCalled();
        });

        it("should increment usage counter", async () => {
            mockGetRedis.mockReturnValue(mockRedis as unknown as ReturnType<typeof getRedis>);
            mockRedis.incr.mockResolvedValue(1);
            mockRedis.expire.mockResolvedValue(true);

            await incrementAIUsage(userId);

            const today = new Date().toISOString().split("T")[0];
            expect(mockRedis.incr).toHaveBeenCalledWith(`ai-usage:${userId}:${today}`);
        });

        it("should set expiry on the key", async () => {
            mockGetRedis.mockReturnValue(mockRedis as unknown as ReturnType<typeof getRedis>);
            mockRedis.incr.mockResolvedValue(1);
            mockRedis.expire.mockResolvedValue(true);

            await incrementAIUsage(userId);

            const today = new Date().toISOString().split("T")[0];
            expect(mockRedis.expire).toHaveBeenCalledWith(
                `ai-usage:${userId}:${today}`,
                48 * 60 * 60 // 48 hours
            );
        });

        it("should handle Redis errors gracefully", async () => {
            mockGetRedis.mockReturnValue(mockRedis as unknown as ReturnType<typeof getRedis>);
            mockRedis.incr.mockRejectedValue(new Error("Redis error"));

            // Should not throw
            await expect(incrementAIUsage(userId)).resolves.not.toThrow();
        });
    });

    describe("getAIUsageStats", () => {
        it("should return usage stats", async () => {
            mockGetRedis.mockReturnValue(mockRedis as unknown as ReturnType<typeof getRedis>);
            mockRedis.get.mockResolvedValue(0);

            const stats = await getAIUsageStats(userId);

            expect(stats).toHaveProperty("used");
            expect(stats).toHaveProperty("limit");
            expect(stats).toHaveProperty("remaining");
            expect(stats).toHaveProperty("resetAt");
        });
    });
});

