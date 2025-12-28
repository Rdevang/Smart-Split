import { getRedis, recordFailure, recordSuccess, REDIS_TIMEOUT_MS } from "./redis";
import { compressIfNeeded, decompressIfNeeded, COMPRESSION_THRESHOLD } from "./compression";

// ============================================
// PERFORMANCE: Timeout wrapper for Redis ops
// ============================================
// Prevents Redis from becoming a bottleneck when slow/unreachable

async function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    fallback: T
): Promise<T> {
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<T>((resolve) => {
        timeoutId = setTimeout(() => resolve(fallback), timeoutMs);
    });

    try {
        const result = await Promise.race([promise, timeoutPromise]);
        clearTimeout(timeoutId!);
        return result;
    } catch {
        clearTimeout(timeoutId!);
        return fallback;
    }
}

// ============================================
// CACHE VERSIONING (Per-Data-Type)
// ============================================
// Prevents "corrupted cache" scenario when data structure changes.
// 
// Problem: Deploy new code that expects { firstName, lastName }
//          but Redis has old cached { name } → site crashes!
// 
// Solution: Version keys BY DATA TYPE. When you change a specific data
//           structure, bump ONLY that version. Other caches stay warm.
// 
// WHEN TO BUMP A VERSION:
// - Changed the shape of that specific cached data
// - Changed how that data is computed
// - Changed the query that fetches that data
// 
// EXAMPLE: Changed group balance calculation?
//          → Bump DATA_VERSIONS.balances from "v1" to "v2"
//          → Only balance caches are invalidated
//          → Group details, user profiles, etc. stay cached

/**
 * Per-data-type cache versions
 * Bump ONLY the specific type when its structure changes
 */
export const DATA_VERSIONS = {
    // Group data
    groups: "v1",       // Group details, members, settings
    balances: "v1",     // Balance calculations (expensive!)
    settlements: "v1",  // Settlement records

    // Expense data
    expenses: "v1",     // Expense lists and details
    analytics: "v1",    // Charts, trends, aggregations

    // User data
    users: "v1",        // User profiles, preferences
    dashboard: "v1",    // Dashboard aggregates

    // Activity
    activity: "v1",     // Activity feeds
} as const;

/**
 * Get versioned key for a specific data type
 * 
 * @example
 * versionedKey("groups", "group:123:details") → "groups-v1:group:123:details"
 */
export function versionedKey(
    dataType: keyof typeof DATA_VERSIONS,
    key: string
): string {
    const version = DATA_VERSIONS[dataType];
    return `${dataType}-${version}:${key}`;
}

/**
 * Check if a key is already versioned (has any data type prefix)
 */
function isVersioned(key: string): boolean {
    return Object.keys(DATA_VERSIONS).some(type =>
        key.startsWith(`${type}-`)
    );
}

/**
 * Auto-version a raw key by detecting its type from the key pattern
 * Falls back to "groups-v1" if type cannot be determined
 */
export function autoVersionKey(key: string): string {
    // Already versioned? Return as-is
    if (isVersioned(key)) {
        return key;
    }

    // Detect data type from key pattern
    if (key.includes(":balances") || key.includes(":balance")) {
        return versionedKey("balances", key);
    }
    if (key.includes(":settlements") || key.includes(":settlement")) {
        return versionedKey("settlements", key);
    }
    if (key.includes(":expenses") || key.includes(":expense")) {
        return versionedKey("expenses", key);
    }
    if (key.includes(":analytics") || key.includes(":trend") || key.includes(":category")) {
        return versionedKey("analytics", key);
    }
    if (key.includes(":dashboard") || key.includes(":recent")) {
        return versionedKey("dashboard", key);
    }
    if (key.includes(":activity")) {
        return versionedKey("activity", key);
    }
    if (key.startsWith("user:")) {
        return versionedKey("users", key);
    }
    if (key.startsWith("group:")) {
        return versionedKey("groups", key);
    }

    // Default fallback
    return versionedKey("groups", key);
}

// ============================================
// CACHE KEYS (Pre-versioned by data type)
// ============================================

export const CacheKeys = {
    // Group-related (uses "groups" version)
    groupDetails: (groupId: string) => versionedKey("groups", `group:${groupId}:details`),
    groupMembers: (groupId: string) => versionedKey("groups", `group:${groupId}:members`),

    // Balances (uses "balances" version - expensive computation!)
    groupBalances: (groupId: string) => versionedKey("balances", `group:${groupId}:balances`),

    // Settlements (uses "settlements" version)
    groupSettlements: (groupId: string) => versionedKey("settlements", `group:${groupId}:settlements`),

    // Analytics (uses "analytics" version)
    groupAnalytics: (groupId: string) => versionedKey("analytics", `group:${groupId}:analytics`),
    groupExpensesByCategory: (groupId: string) => versionedKey("analytics", `group:${groupId}:expenses:category`),
    groupExpensesTrend: (groupId: string) => versionedKey("analytics", `group:${groupId}:expenses:trend`),

    // Expenses (uses "expenses" version)
    groupExpenses: (groupId: string) => versionedKey("expenses", `group:${groupId}:expenses`),

    // User-related (uses "users" version)
    userProfile: (userId: string) => versionedKey("users", `user:${userId}:profile`),
    userGroups: (userId: string) => versionedKey("users", `user:${userId}:groups`),
    userFriends: (userId: string) => versionedKey("users", `user:${userId}:friends`),

    // Dashboard (uses "dashboard" version)
    userDashboard: (userId: string) => versionedKey("dashboard", `user:${userId}:dashboard`),

    // Activity feed (uses "activity" version)
    groupActivity: (groupId: string) => versionedKey("activity", `group:${groupId}:activity`),
} as const;

// TTL values in seconds
export const CacheTTL = {
    SHORT: 60,           // 1 minute - for very dynamic data
    MEDIUM: 300,         // 5 minutes - for semi-dynamic data
    LONG: 900,           // 15 minutes - for expensive computations
    VERY_LONG: 3600,     // 1 hour - for rarely changing data
    NULL_RESULT: 120,    // 2 minutes - for caching "not found" results (cache penetration protection)
} as const;

// Stale time = when to start background refresh (before actual expiry)
// Data is still served but refreshed in background
const STALE_RATIO = 0.8; // Start refresh at 80% of TTL

// Jitter: Add random variation to TTL to prevent thundering herd on expiration
// E.g., 300 seconds ± 10% = 270-330 seconds
const JITTER_PERCENT = 0.1; // 10% variation

/**
 * Add jitter to TTL to prevent synchronized cache expiration (thundering herd)
 * Example: TTL of 300 becomes 270-330 (±10%)
 */
function addJitter(ttl: number): number {
    const jitterRange = ttl * JITTER_PERCENT;
    const jitter = (Math.random() * 2 - 1) * jitterRange; // Random between -jitterRange and +jitterRange
    return Math.round(ttl + jitter);
}

// ============================================
// TIMING ATTACK PROTECTION
// ============================================
// 
// Problem: Cache hits are fast (~1ms), cache misses are slow (~100ms+)
// Attackers can infer data existence by measuring response times.
// 
// Solution: Add minimum response time to normalize timing differences.
// This is especially important for sensitive queries (user existence, etc.)

/** Default minimum response time in milliseconds */
const DEFAULT_MIN_RESPONSE_TIME_MS = 50;

/**
 * Ensure operation takes at least minTime milliseconds
 * Prevents timing attacks by normalizing response times
 * 
 * @param startTime - Performance.now() timestamp when operation started
 * @param minTime - Minimum time the operation should take (ms)
 */
async function enforceMinimumResponseTime(startTime: number, minTime: number): Promise<void> {
    const elapsed = performance.now() - startTime;
    const remaining = minTime - elapsed;

    if (remaining > 0) {
        // Add small random jitter (±10%) to prevent perfect timing analysis
        const jitteredRemaining = remaining * (0.9 + Math.random() * 0.2);
        await new Promise(resolve => setTimeout(resolve, jitteredRemaining));
    }
}

// Sentinel value to distinguish "cached null" from "cache miss"
const NULL_SENTINEL = "__NULL__";

// Cache entry with metadata for stale-while-revalidate
interface CacheEntry<T> {
    data: T | typeof NULL_SENTINEL;  // Can be actual data or null sentinel
    timestamp: number;
    isNull?: boolean;  // Flag to indicate this is a cached "not found"
    compressed?: boolean;  // Flag to indicate data is compressed
}

// Compressed cache entry stored in Redis (data is a compressed string)
interface CompressedCacheEntry {
    data: string;  // Compressed JSON string
    timestamp: number;
    isNull?: boolean;
    compressed: true;
}

/**
 * Serialize cache entry with optional compression
 * Large data (>1KB) is automatically compressed
 */
function serializeCacheEntry<T>(entry: CacheEntry<T>): CacheEntry<T> | CompressedCacheEntry {
    const jsonSize = JSON.stringify(entry.data).length;

    // Only compress if data is large enough to benefit
    if (jsonSize < COMPRESSION_THRESHOLD || entry.isNull) {
        return entry;
    }

    // Compress the data
    const compressedData = compressIfNeeded(entry.data);

    return {
        data: compressedData,
        timestamp: entry.timestamp,
        isNull: entry.isNull,
        compressed: true,
    };
}

/**
 * Deserialize cache entry, decompressing if needed
 */
function deserializeCacheEntry<T>(
    entry: CacheEntry<T> | CompressedCacheEntry
): CacheEntry<T> {
    if (!entry.compressed) {
        return entry as CacheEntry<T>;
    }

    // Decompress the data
    const decompressedData = decompressIfNeeded<T>(entry.data as string);

    return {
        data: decompressedData,
        timestamp: entry.timestamp,
        isNull: entry.isNull,
    };
}

/**
 * Generic cache wrapper - SIMPLIFIED for performance
 * 
 * Key optimizations:
 * 1. Timeout on Redis (skip if slow) - prevents Redis from being a bottleneck
 * 2. No locks - accept occasional cache stampede for lower latency
 * 3. Stale-while-revalidate - return stale data, refresh in background
 * 4. TTL jitter - prevents synchronized expiration
 * 
 * @param key - Cache key
 * @param fetcher - Function to fetch data if cache miss
 * @param ttl - Time to live in seconds
 * @returns Cached or fresh data
 */
export async function cached<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = CacheTTL.MEDIUM
): Promise<T> {
    const redis = getRedis();

    // If Redis is not configured, just fetch directly (graceful degradation)
    if (!redis) {
        return fetcher();
    }

    // Auto-version the key to prevent corrupted cache issues on deploy
    const vKey = autoVersionKey(key);

    try {
        // Try to get from cache WITH TIMEOUT - don't let slow Redis block us
        const rawEntry = await withTimeout(
            redis.get<CacheEntry<T> | CompressedCacheEntry>(vKey),
            REDIS_TIMEOUT_MS,
            null // Fallback: treat as cache miss
        );

        // Redis responded successfully - reset circuit breaker
        recordSuccess();

        if (rawEntry !== null && rawEntry.data !== undefined) {
            // Decompress if needed
            const cachedEntry = deserializeCacheEntry<T>(rawEntry);

            // Check if this is a cached "not found" result (cache penetration protection)
            if (cachedEntry.isNull || cachedEntry.data === NULL_SENTINEL) {
                // Return null/empty - prevents repeated DB hits for non-existent data
                return null as T;
            }

            const age = (Date.now() - cachedEntry.timestamp) / 1000; // Age in seconds
            const staleThreshold = ttl * STALE_RATIO;

            if (age < staleThreshold) {
                // Fresh data - return immediately
                return cachedEntry.data as T;
            }

            // Stale but not expired - return immediately BUT refresh in background
            // This is the "stale-while-revalidate" pattern
            refreshInBackground(vKey, fetcher, ttl, redis);
            return cachedEntry.data as T;
        }

        // Cache miss - fetch directly (no lock, accept occasional stampede for speed)
        const freshData = await fetcher();

        // Store in cache in background (don't block response)
        storeInCacheBackground(vKey, freshData, ttl, redis);

        return freshData;
    } catch (error) {
        // Record failure for circuit breaker
        recordFailure();

        // FAIL OPEN: On any Redis error, fall back to database
        console.error(`Cache error for ${key}:`, error);
        return fetcher();
    }
}

/**
 * Cache wrapper with TIMING ATTACK PROTECTION
 * 
 * Use this for sensitive queries where timing differences could leak information:
 * - User existence checks
 * - Permission checks
 * - Rate limit status
 * 
 * Ensures minimum response time to prevent attackers from inferring
 * data existence through timing analysis.
 * 
 * @param key - Cache key
 * @param fetcher - Function to fetch data if cache miss
 * @param ttl - Time to live in seconds
 * @param minResponseTimeMs - Minimum response time in milliseconds (default: 50ms)
 */
export async function cachedSensitive<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = CacheTTL.MEDIUM,
    minResponseTimeMs: number = DEFAULT_MIN_RESPONSE_TIME_MS
): Promise<T> {
    const startTime = performance.now();

    try {
        const result = await cached(key, fetcher, ttl);

        // Enforce minimum response time to prevent timing attacks
        await enforceMinimumResponseTime(startTime, minResponseTimeMs);

        return result;
    } catch (error) {
        // Still enforce minimum time even on error (prevent error timing leaks)
        await enforceMinimumResponseTime(startTime, minResponseTimeMs);
        throw error;
    }
}

/**
 * Store data in cache in background (non-blocking)
 * Simplified: No locks, just store with jitter
 */
function storeInCacheBackground<T>(
    key: string,
    data: T,
    ttl: number,
    redis: NonNullable<ReturnType<typeof getRedis>>
): void {
    // Fire and forget - don't block the response
    (async () => {
        try {
            // Check if result is null/empty (cache penetration protection)
            const isNullResult = data === null ||
                data === undefined ||
                (Array.isArray(data) && data.length === 0);

            if (isNullResult) {
                // Cache the "not found" with shorter TTL
                const nullEntry: CacheEntry<T> = {
                    data: NULL_SENTINEL as T,
                    timestamp: Date.now(),
                    isNull: true,
                };
                await redis.set(key, nullEntry, { ex: CacheTTL.NULL_RESULT });
            } else {
                // Store real data with jittered TTL (compress if large)
                const entry: CacheEntry<T> = {
                    data: data,
                    timestamp: Date.now(),
                };
                const serializedEntry = serializeCacheEntry(entry);
                const jitteredTTL = addJitter(ttl);
                await redis.set(key, serializedEntry, { ex: jitteredTTL });
            }
        } catch (error) {
            console.error(`Background cache store failed for ${key}:`, error);
        }
    })();
}

/**
 * Refresh cache in background (non-blocking)
 * Uses jitter to prevent synchronized expiration
 */
function refreshInBackground<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number,
    redis: NonNullable<ReturnType<typeof getRedis>>
): void {
    // Don't await - run in background
    const refreshKey = `refresh:${key}`;

    // Check if refresh is already in progress
    redis.set(refreshKey, "1", { ex: 30, nx: true }).then(async (acquired) => {
        if (!acquired) return; // Another refresh in progress

        try {
            const freshData = await fetcher();

            // Check if result is null/empty
            const isNullResult = freshData === null ||
                freshData === undefined ||
                (Array.isArray(freshData) && freshData.length === 0);

            if (isNullResult) {
                const nullEntry: CacheEntry<T> = {
                    data: NULL_SENTINEL as T,
                    timestamp: Date.now(),
                    isNull: true,
                };
                await redis.set(key, nullEntry, { ex: CacheTTL.NULL_RESULT });
            } else {
                // Store with compression if large
                const entry: CacheEntry<T> = {
                    data: freshData,
                    timestamp: Date.now(),
                };
                const serializedEntry = serializeCacheEntry(entry);
                const jitteredTTL = addJitter(ttl);
                await redis.set(key, serializedEntry, { ex: jitteredTTL });
            }
        } catch (error) {
            console.error(`Background refresh failed for ${key}:`, error);
        } finally {
            redis.del(refreshKey).catch(() => { });
        }
    }).catch(() => { });
}

/**
 * Invalidate a specific cache key
 */
export async function invalidateCache(key: string): Promise<void> {
    const redis = getRedis();
    if (!redis) return;

    // Auto-version the key based on its data type
    const vKey = autoVersionKey(key);

    try {
        await redis.del(vKey);
    } catch (error) {
        console.error(`Failed to invalidate cache ${vKey}:`, error);
    }
}

/**
 * Invalidate multiple cache keys matching a pattern
 * Use with caution - can be slow with many keys
 */
export async function invalidateCachePattern(pattern: string): Promise<void> {
    const redis = getRedis();
    if (!redis) return;

    // Auto-version the pattern based on its data type
    const vPattern = autoVersionKey(pattern);

    try {
        // Upstash SCAN returns [cursor: string, keys: string[]]
        let cursor = "0";
        const keysToDelete: string[] = [];

        do {
            const result = await redis.scan(cursor, { match: vPattern, count: 100 });
            cursor = String(result[0]); // Cursor is returned as string
            keysToDelete.push(...result[1]);
        } while (cursor !== "0");

        if (keysToDelete.length > 0) {
            await redis.del(...keysToDelete);
        }
    } catch (error) {
        console.error(`Failed to invalidate cache pattern ${pattern}:`, error);
    }
}

/**
 * Invalidate all cache keys for a group
 * Call this when group data changes (expense added/deleted, settlement made, etc.)
 */
export async function invalidateGroupCache(groupId: string): Promise<void> {
    const redis = getRedis();
    if (!redis) {
        console.log(`[Cache] No Redis connection, skipping invalidation for group ${groupId}`);
        return;
    }

    const keysToInvalidate = [
        // Group data
        CacheKeys.groupBalances(groupId),
        CacheKeys.groupMembers(groupId),
        CacheKeys.groupDetails(groupId),
        CacheKeys.groupActivity(groupId),
        CacheKeys.groupSettlements(groupId),

        // Expenses (including paginated cache key used by cached service)
        CacheKeys.groupExpenses(groupId),
        versionedKey("expenses", `group:${groupId}:expenses:page1`),
        versionedKey("expenses", `group:${groupId}:expense_count`),

        // Analytics
        CacheKeys.groupAnalytics(groupId),
        CacheKeys.groupExpensesByCategory(groupId),
        CacheKeys.groupExpensesTrend(groupId),
    ];

    try {
        const result = await redis.del(...keysToInvalidate);
        console.log(`[Cache] Invalidated ${result} keys for group ${groupId}`);
    } catch (error) {
        console.error(`Failed to invalidate group cache ${groupId}:`, error);
    }
}

/**
 * Invalidate user dashboard cache
 * Call this when user's group memberships or expenses change
 */
export async function invalidateUserCache(userId: string): Promise<void> {
    const redis = getRedis();
    if (!redis) return;

    const keysToInvalidate = [
        CacheKeys.userDashboard(userId),
        CacheKeys.userGroups(userId),
        CacheKeys.userFriends(userId),
        // User expenses cache (used by cached service)
        versionedKey("expenses", `user:${userId}:expenses:page1`),
        versionedKey("dashboard", `user:${userId}:recent_expenses:5`),
        versionedKey("dashboard", `user:${userId}:recent_expenses:10`),
    ];

    try {
        await redis.del(...keysToInvalidate);
    } catch (error) {
        console.error(`Failed to invalidate user cache ${userId}:`, error);
    }
}

/**
 * Batch cache multiple items at once
 */
export async function cacheMultiple<T>(
    items: Array<{ key: string; value: T; ttl?: number }>
): Promise<void> {
    const redis = getRedis();
    if (!redis) return;

    try {
        const pipeline = redis.pipeline();

        for (const { key, value, ttl = CacheTTL.MEDIUM } of items) {
            pipeline.set(key, value, { ex: ttl });
        }

        await pipeline.exec();
    } catch (error) {
        console.error("Failed to batch cache items:", error);
    }
}

/**
 * Get multiple cached items at once
 */
export async function getCachedMultiple<T>(keys: string[]): Promise<(T | null)[]> {
    const redis = getRedis();
    if (!redis) return keys.map(() => null);

    try {
        return await redis.mget<T[]>(...keys);
    } catch (error) {
        console.error("Failed to get cached items:", error);
        return keys.map(() => null);
    }
}

