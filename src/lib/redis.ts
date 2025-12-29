import { Redis } from "@upstash/redis";

// Singleton Redis client
// Uses HTTP-based connection - perfect for serverless (no connection pooling issues)
let redis: Redis | null = null;

// ============================================
// PERFORMANCE: Timeout for Redis operations
// ============================================
// If Redis is slow (network issues, cold start), skip it and go direct to DB
// This prevents Redis from becoming a bottleneck

export const REDIS_TIMEOUT_MS = 150; // Skip cache if Redis takes > 150ms

// ============================================
// CIRCUIT BREAKER PATTERN
// ============================================
// If Redis fails repeatedly, stop trying for a while
// This prevents cascading failures and reduces latency during outages

interface CircuitBreaker {
    failures: number;
    lastFailure: number;
    isOpen: boolean;
}

const circuitBreaker: CircuitBreaker = {
    failures: 0,
    lastFailure: 0,
    isOpen: false,
};

// Circuit breaker config
const FAILURE_THRESHOLD = 5;      // Open circuit after 5 consecutive failures
const RECOVERY_TIME_MS = 30000;   // Try again after 30 seconds

/**
 * Record a Redis failure - may open the circuit
 */
export function recordFailure(): void {
    circuitBreaker.failures++;
    circuitBreaker.lastFailure = Date.now();

    if (circuitBreaker.failures >= FAILURE_THRESHOLD) {
        circuitBreaker.isOpen = true;
        console.warn("🔴 Redis circuit breaker OPEN after", circuitBreaker.failures, "failures. Bypassing cache for", RECOVERY_TIME_MS / 1000, "s");
    }
}

/**
 * Record a Redis success - resets the circuit
 */
export function recordSuccess(): void {
    if (circuitBreaker.failures > 0) {
        circuitBreaker.failures = 0;
        circuitBreaker.isOpen = false;
    }
}

/**
 * Check if circuit is open (should bypass Redis)
 */
function isCircuitOpen(): boolean {
    if (!circuitBreaker.isOpen) {
        return false;
    }

    // Check if recovery time has passed
    const timeSinceLastFailure = Date.now() - circuitBreaker.lastFailure;
    if (timeSinceLastFailure >= RECOVERY_TIME_MS) {
        // Half-open: allow one request through to test
        console.log("🟡 Redis circuit breaker HALF-OPEN - testing connection...");
        circuitBreaker.isOpen = false;
        circuitBreaker.failures = FAILURE_THRESHOLD - 1; // One more failure will re-open
        return false;
    }

    return true;
}

// ============================================
// REDIS CLIENT
// ============================================

export function getRedis(): Redis | null {
    // Circuit breaker: if Redis is failing, skip it entirely
    if (isCircuitOpen()) {
        return null;
    }

    // Return null if Redis is not configured (graceful degradation)
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
        if (process.env.NODE_ENV === "development") {
            console.warn(
                "⚠️ Redis not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for caching."
            );
        }
        return null;
    }

    if (!redis) {
        redis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
    }

    return redis;
}

// Export for direct usage when needed
export { Redis };

