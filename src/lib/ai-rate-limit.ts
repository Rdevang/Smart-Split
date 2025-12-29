import { getRedis } from "@/lib/redis";

// AI usage limits per user per day
const AI_DAILY_LIMIT = 1; // 1 AI parse per user per day

/**
 * Check if user has remaining AI requests for today
 * Returns { allowed: boolean, remaining: number, resetAt: Date }
 */
export async function checkAIUsage(userId: string): Promise<{
    allowed: boolean;
    remaining: number;
    used: number;
    limit: number;
    resetAt: Date;
}> {
    const redis = getRedis();
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const key = `ai-usage:${userId}:${today}`;
    
    // Calculate reset time (midnight UTC)
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);

    // If Redis is not available, allow the request (fail open)
    if (!redis) {
        return {
            allowed: true,
            remaining: AI_DAILY_LIMIT,
            used: 0,
            limit: AI_DAILY_LIMIT,
            resetAt: tomorrow,
        };
    }

    try {
        // Get current usage count
        const currentUsage = await redis.get<number>(key) || 0;
        const remaining = Math.max(0, AI_DAILY_LIMIT - currentUsage);

        return {
            allowed: currentUsage < AI_DAILY_LIMIT,
            remaining,
            used: currentUsage,
            limit: AI_DAILY_LIMIT,
            resetAt: tomorrow,
        };
    } catch (error) {
        console.error("[AI Rate Limit] Error checking usage:", error);
        // Fail open - allow request if we can't check
        return {
            allowed: true,
            remaining: AI_DAILY_LIMIT,
            used: 0,
            limit: AI_DAILY_LIMIT,
            resetAt: tomorrow,
        };
    }
}

/**
 * Increment AI usage count for user
 * Call this AFTER a successful AI request
 */
export async function incrementAIUsage(userId: string): Promise<void> {
    const redis = getRedis();
    if (!redis) return;

    const today = new Date().toISOString().split("T")[0];
    const key = `ai-usage:${userId}:${today}`;

    try {
        // Increment and set expiry (48 hours to be safe)
        await redis.incr(key);
        await redis.expire(key, 48 * 60 * 60); // 48 hours TTL
    } catch (error) {
        console.error("[AI Rate Limit] Error incrementing usage:", error);
    }
}

/**
 * Get user's AI usage stats
 */
export async function getAIUsageStats(userId: string): Promise<{
    used: number;
    limit: number;
    remaining: number;
    resetAt: Date;
}> {
    const usage = await checkAIUsage(userId);
    return {
        used: usage.used,
        limit: usage.limit,
        remaining: usage.remaining,
        resetAt: usage.resetAt,
    };
}

