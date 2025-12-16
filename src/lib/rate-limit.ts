import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ============================================
// RATE LIMITING CONFIGURATION
// ============================================
// Uses Token Bucket algorithm via @upstash/ratelimit
// Token Bucket: Users get X tokens, each request costs 1 token
// Tokens refill over time. If empty, request is blocked.

// Different rate limits for different scenarios
export const RateLimitConfig = {
    // General API requests (authenticated users)
    api: {
        requests: 100,      // 100 requests
        window: "1 m",      // per minute
    },
    // Authentication attempts (login, register)
    auth: {
        requests: 10,       // 10 attempts
        window: "15 m",     // per 15 minutes (prevent brute force)
    },
    // Sensitive operations (password reset, etc.)
    sensitive: {
        requests: 5,        // 5 requests
        window: "1 h",      // per hour
    },
    // Public endpoints (feedback form, etc.)
    public: {
        requests: 20,       // 20 requests
        window: "1 m",      // per minute
    },
    // Strict limit for expensive operations (analytics, exports)
    expensive: {
        requests: 10,       // 10 requests  
        window: "1 m",      // per minute
    },
} as const;

type RateLimitType = keyof typeof RateLimitConfig;

// ============================================
// RATE LIMITER INSTANCES
// ============================================

// Cache rate limiter instances
const rateLimiters = new Map<RateLimitType, Ratelimit>();

/**
 * Get or create a rate limiter instance
 */
function getRateLimiter(type: RateLimitType): Ratelimit | null {
    // Check if Redis is configured
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
        return null;
    }

    // Return cached instance if exists
    if (rateLimiters.has(type)) {
        return rateLimiters.get(type)!;
    }

    // Create new Redis client for rate limiting
    const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    const config = RateLimitConfig[type];

    // Create rate limiter with sliding window algorithm
    const limiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(config.requests, config.window),
        analytics: true, // Enable analytics in Upstash dashboard
        prefix: `ratelimit:${type}`, // Separate keys per limit type
    });

    rateLimiters.set(type, limiter);
    return limiter;
}

// ============================================
// RATE LIMIT CHECK FUNCTION
// ============================================

export interface RateLimitResult {
    success: boolean;
    limit: number;
    remaining: number;
    reset: number; // Unix timestamp when limit resets
    retryAfter?: number; // Seconds until retry allowed
}

/**
 * Check if request should be rate limited
 * 
 * @param identifier - Unique identifier (IP, user ID, etc.)
 * @param type - Type of rate limit to apply
 * @returns Rate limit result with success status and metadata
 */
export async function checkRateLimit(
    identifier: string,
    type: RateLimitType = "api"
): Promise<RateLimitResult> {
    const limiter = getRateLimiter(type);

    // If rate limiting is not configured, allow all requests
    if (!limiter) {
        const config = RateLimitConfig[type];
        return {
            success: true,
            limit: config.requests,
            remaining: config.requests,
            reset: Date.now() + 60000,
        };
    }

    try {
        const result = await limiter.limit(identifier);

        return {
            success: result.success,
            limit: result.limit,
            remaining: result.remaining,
            reset: result.reset,
            retryAfter: result.success ? undefined : Math.ceil((result.reset - Date.now()) / 1000),
        };
    } catch (error) {
        // On error, fail open (allow the request)
        console.error("Rate limit check failed:", error);
        const config = RateLimitConfig[type];
        return {
            success: true,
            limit: config.requests,
            remaining: config.requests,
            reset: Date.now() + 60000,
        };
    }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get client IP from request headers
 * Works with Vercel, Cloudflare, and standard proxies
 */
export function getClientIP(request: Request): string {
    // Vercel
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) {
        return forwardedFor.split(",")[0].trim();
    }

    // Cloudflare
    const cfConnectingIP = request.headers.get("cf-connecting-ip");
    if (cfConnectingIP) {
        return cfConnectingIP;
    }

    // Real IP header (nginx)
    const realIP = request.headers.get("x-real-ip");
    if (realIP) {
        return realIP;
    }

    // Fallback
    return "unknown";
}

/**
 * Create rate limit headers for response
 */
export function createRateLimitHeaders(result: RateLimitResult): HeadersInit {
    return {
        "X-RateLimit-Limit": result.limit.toString(),
        "X-RateLimit-Remaining": result.remaining.toString(),
        "X-RateLimit-Reset": result.reset.toString(),
        ...(result.retryAfter && { "Retry-After": result.retryAfter.toString() }),
    };
}

