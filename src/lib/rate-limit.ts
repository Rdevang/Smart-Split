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
        windowMs: 60000,    // 1 minute in ms (for in-memory fallback)
    },
    // Authentication attempts (login, register)
    auth: {
        requests: 10,       // 10 attempts
        window: "15 m",     // per 15 minutes (prevent brute force)
        windowMs: 900000,   // 15 minutes in ms
    },
    // Sensitive operations (password reset, etc.)
    sensitive: {
        requests: 5,        // 5 requests
        window: "1 h",      // per hour
        windowMs: 3600000,  // 1 hour in ms
    },
    // Public endpoints (feedback form, etc.)
    public: {
        requests: 20,       // 20 requests
        window: "1 m",      // per minute
        windowMs: 60000,    // 1 minute in ms
    },
    // Strict limit for expensive operations (analytics, exports)
    expensive: {
        requests: 10,       // 10 requests  
        window: "1 m",      // per minute
        windowMs: 60000,    // 1 minute in ms
    },
    // Invite code attempts - very strict to prevent brute force
    invite: {
        requests: 10,       // 10 attempts
        window: "1 h",      // per hour
        windowMs: 3600000,  // 1 hour in ms
    },
    // Financial operations (settlements) - strict to prevent abuse
    financial: {
        requests: 20,       // 20 settlements
        window: "1 h",      // per hour
        windowMs: 3600000,  // 1 hour in ms
    },
    // Critical write operations (create expense, group)
    write: {
        requests: 50,       // 50 write operations
        window: "1 h",      // per hour
        windowMs: 3600000,  // 1 hour in ms
    },
} as const;

type RateLimitType = keyof typeof RateLimitConfig;

// ============================================
// IN-MEMORY FALLBACK RATE LIMITER
// ============================================
// Used when Redis is unavailable - NEVER fail open for security

interface InMemoryEntry {
    count: number;
    resetAt: number;
}

// In-memory store for fallback rate limiting
// Note: This doesn't work across multiple serverless instances, but it's
// better than nothing when Redis is down
const inMemoryStore = new Map<string, InMemoryEntry>();

// Clean up expired entries periodically (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupExpiredEntries(): void {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL) return;

    lastCleanup = now;
    for (const [key, entry] of inMemoryStore.entries()) {
        if (entry.resetAt < now) {
            inMemoryStore.delete(key);
        }
    }
}

/**
 * In-memory rate limit check (fallback when Redis fails)
 * IMPORTANT: This doesn't fail open - it enforces limits locally
 */
function checkInMemoryRateLimit(
    identifier: string,
    type: RateLimitType
): RateLimitResult {
    cleanupExpiredEntries();

    const config = RateLimitConfig[type];
    const key = `${type}:${identifier}`;
    const now = Date.now();

    let entry = inMemoryStore.get(key);

    // If no entry or expired, create new one
    if (!entry || entry.resetAt < now) {
        entry = {
            count: 1,
            resetAt: now + config.windowMs,
        };
        inMemoryStore.set(key, entry);

        return {
            success: true,
            limit: config.requests,
            remaining: config.requests - 1,
            reset: entry.resetAt,
        };
    }

    // Increment count
    entry.count++;

    // Check if over limit
    if (entry.count > config.requests) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        return {
            success: false,
            limit: config.requests,
            remaining: 0,
            reset: entry.resetAt,
            retryAfter,
        };
    }

    return {
        success: true,
        limit: config.requests,
        remaining: config.requests - entry.count,
        reset: entry.resetAt,
    };
}

// ============================================
// REDIS RATE LIMITER INSTANCES
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
 * SECURITY: Never fails open. Uses in-memory fallback when Redis is unavailable.
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

    // If Redis not configured, use in-memory fallback (NOT fail open!)
    if (!limiter) {
        return checkInMemoryRateLimit(identifier, type);
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
        // SECURITY FIX: On Redis error, use in-memory fallback instead of failing open
        console.error("Redis rate limit failed, using in-memory fallback:", error);
        return checkInMemoryRateLimit(identifier, type);
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

