# System Design: Performance & Reliability

> **Version:** 1.0.0 | **Last Updated:** 2024-12-16

This document covers the system design patterns implemented in Smart Split for performance, reliability, and cost optimization.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Redis Caching Layer](#1-redis-caching-layer)
3. [Rate Limiting (DDoS Protection)](#2-rate-limiting-ddos-protection)
4. [Tag-Based Cache Invalidation](#3-tag-based-cache-invalidation)
5. [Optimistic UI](#4-optimistic-ui)
6. [Compression](#5-compression)
7. [CDN Graceful Degradation](#7-cdn-graceful-degradation-stale-if-error)
8. [Cache Versioning](#8-cache-versioning-safe-deployments)
9. [Distributed Locking](#6-distributed-locking-race-condition-prevention)
10. [Bundle Analysis](#9-bundle-analysis-tree-shaking)
11. [Testing & Monitoring](#testing--monitoring)
12. [Configuration](#configuration)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Browser)                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Optimistic  │  │   React     │  │   Next.js   │  │   Toast     │        │
│  │     UI      │  │   Query     │  │   Router    │  │ Notifications│        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└────────────────────────────────────────┬────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CDN (Vercel Edge Network)                            │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │                  STALE-IF-ERROR CACHING                          │        │
│  │   • Cache-Control: s-maxage=60, stale-if-error=86400             │        │
│  │   • Serves stale content when origin is down                     │        │
│  │   • Public endpoints only (health, static)                       │        │
│  └─────────────────────────────────────────────────────────────────┘        │
└────────────────────────────────────────┬────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EDGE (Vercel Middleware)                           │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │                      RATE LIMITER                                │        │
│  │   • Token Bucket Algorithm (via @upstash/ratelimit)              │        │
│  │   • Path-based limits (auth: 10/15m, api: 100/1m)                │        │
│  │   • IP-based identification                                       │        │
│  └─────────────────────────────────────────────────────────────────┘        │
└────────────────────────────────────────┬────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SERVER (Next.js App Router)                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Server    │  │   Server    │  │   API       │  │   Cache     │        │
│  │ Components  │  │  Actions    │  │  Routes     │  │   Tags      │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │                │
│         └────────────────┴────────────────┴────────────────┘                │
│                                   │                                          │
│                                   ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │                      CACHING LAYER                               │        │
│  │   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │        │
│  │   │   Redis     │    │  Next.js    │    │ Compression │         │        │
│  │   │  (Upstash)  │◄──►│ Data Cache  │◄──►│   (gzip)    │         │        │
│  │   └─────────────┘    └─────────────┘    └─────────────┘         │        │
│  │   • Circuit Breaker  • unstable_cache   • Auto >1KB             │        │
│  │   • SWR Pattern      • Tag invalidation • ~80% savings          │        │
│  │   • Null caching     • revalidateTag()                          │        │
│  └─────────────────────────────────────────────────────────────────┘        │
└────────────────────────────────────────┬────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            DATABASE (Supabase)                               │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │   PostgreSQL + Row Level Security + Real-time Subscriptions     │        │
│  └─────────────────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Redis Caching Layer

### Purpose
Reduce database load and improve response times by caching expensive queries.

### Files
- `src/lib/redis.ts` - Redis client with circuit breaker
- `src/lib/cache.ts` - Caching utilities
- `src/services/*.cached.server.ts` - Cached service wrappers

### Features

#### 1.1 Circuit Breaker Pattern
Prevents cascading failures when Redis is unavailable.

```typescript
// src/lib/redis.ts
const circuitBreaker = {
    failures: 0,
    lastFailureTime: 0,
    isOpen: false,
    resetTimeout: 60 * 1000,     // 1 minute cooldown
    failureThreshold: 5,         // 5 failures to open
};

export function getRedis(): Redis | null {
    // Check if circuit is open
    if (circuitBreaker.isOpen) {
        const elapsed = Date.now() - circuitBreaker.lastFailureTime;
        if (elapsed < circuitBreaker.resetTimeout) {
            return null;  // Fail fast, bypass cache
        }
        // Half-open: try again
        circuitBreaker.isOpen = false;
    }
    
    return redis;
}
```

**State Machine:**
```
     ┌──────────────────────────────────────────┐
     │                 CLOSED                    │
     │  (Normal operation, cache works)          │
     └─────────────────┬────────────────────────┘
                       │ 5 failures
                       ▼
     ┌──────────────────────────────────────────┐
     │                  OPEN                     │
     │  (Circuit tripped, bypass cache)          │
     └─────────────────┬────────────────────────┘
                       │ 60 seconds
                       ▼
     ┌──────────────────────────────────────────┐
     │               HALF-OPEN                   │
     │  (Test connection, may close or reopen)   │
     └──────────────────────────────────────────┘
```

#### 1.2 Stale-While-Revalidate (SWR)
Return stale data immediately while refreshing in background.

```typescript
// src/lib/cache.ts
const STALE_RATIO = 0.8;  // Refresh at 80% of TTL

if (cachedEntry) {
    const age = (Date.now() - cachedEntry.timestamp) / 1000;
    const staleThreshold = ttl * STALE_RATIO;
    
    if (age < staleThreshold) {
        return cachedEntry.data;  // Fresh
    }
    
    // Stale but usable - refresh in background
    refreshInBackground(key, fetcher, ttl, redis);
    return cachedEntry.data;  // Return stale immediately
}
```

**Timeline:**
```
TTL = 300 seconds (5 minutes)

0s          240s        300s
├───────────┼───────────┤
│   FRESH   │   STALE   │ EXPIRED
│           │           │
│  Return   │  Return + │  Fetch
│  cached   │  refresh  │  new
```

#### 1.3 Cache Stampede Protection
Prevent thundering herd when cache expires.

```typescript
async function fetchWithLock<T>(key, fetcher, ttl, redis) {
    const lockKey = `lock:${key}`;
    
    // Try to acquire lock (only one process wins)
    const acquired = await redis.set(lockKey, "1", { 
        ex: 10,   // Lock expires in 10s (safety)
        nx: true  // Only if not exists
    });
    
    if (!acquired) {
        // Another process is fetching - wait and retry cache
        await sleep(100);
        return redis.get(key);
    }
    
    try {
        const data = await fetcher();
        await redis.set(key, data, { ex: ttl });
        return data;
    } finally {
        redis.del(lockKey);  // Release lock
    }
}
```

#### 1.4 TTL Jitter
Prevent synchronized cache expiration.

```typescript
const JITTER_PERCENT = 0.1;  // ±10%

function addJitter(ttl: number): number {
    const jitter = (Math.random() * 2 - 1) * ttl * JITTER_PERCENT;
    return Math.round(ttl + jitter);
}

// TTL of 300s becomes 270-330s randomly
```

#### 1.5 Null Caching (Cache Penetration Protection)
Cache "not found" results to prevent repeated DB hits.

```typescript
const NULL_SENTINEL = "__NULL__";

if (freshData === null) {
    // Cache the "not found" with short TTL
    await redis.set(key, { 
        data: NULL_SENTINEL, 
        isNull: true 
    }, { ex: 120 });  // 2 minutes
}
```

### Cache Keys & TTLs

| Key Pattern | TTL | Description |
|-------------|-----|-------------|
| `group:{id}:balances` | 15 min | Expensive balance computation |
| `group:{id}:details` | 5 min | Group with members |
| `group:{id}:expenses:page1` | 5 min | First page of expenses |
| `user:{id}:dashboard` | 5 min | Dashboard aggregates |
| `user:{id}:groups` | 5 min | User's group list |

---

## 2. Rate Limiting (DDoS Protection)

### Purpose
Protect APIs from abuse, prevent cost overruns, and ensure fair usage.

### Files
- `src/lib/rate-limit.ts` - Rate limiting utilities
- `src/proxy.ts` - Middleware with rate limiting

### Configuration

```typescript
// src/lib/rate-limit.ts
export const RateLimitConfig = {
    // General API requests
    api: { requests: 100, window: "1 m" },
    
    // Authentication (brute force protection)
    auth: { requests: 10, window: "15 m" },
    
    // Sensitive operations
    sensitive: { requests: 5, window: "1 h" },
    
    // Public endpoints
    public: { requests: 20, window: "1 m" },
    
    // Expensive operations (analytics)
    expensive: { requests: 10, window: "1 m" },
};
```

### Path-Based Limits

| Path Pattern | Type | Limit | Reason |
|--------------|------|-------|--------|
| `/login`, `/register` | auth | 10/15min | Brute force protection |
| `/forgot-password` | sensitive | 5/hour | Abuse prevention |
| `/feedback`, `/api/feedback` | public | 20/min | Spam prevention |
| `/groups/*/analytics` | expensive | 10/min | Resource protection |
| `/api/*` | api | 100/min | General protection |

### Response Headers

Every response includes rate limit headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1702745200000
```

When rate limited (429 response):
```http
Retry-After: 45
```

### Implementation

```typescript
// src/proxy.ts
export async function proxy(request: NextRequest) {
    const clientIP = getClientIP(request);
    const rateLimitType = getRateLimitType(pathname);
    
    const result = await checkRateLimit(
        `${clientIP}:${rateLimitType}`,
        rateLimitType
    );
    
    if (!result.success) {
        return new NextResponse(
            JSON.stringify({
                error: "Too Many Requests",
                retryAfter: result.retryAfter,
            }),
            { status: 429 }
        );
    }
    
    // Continue with request
    return updateSession(request);
}
```

### Fail Open
If Redis is unavailable, rate limiting is bypassed (allows all requests):

```typescript
if (!limiter) {
    return { success: true };  // Fail open
}
```

---

## 3. Tag-Based Cache Invalidation

### Purpose
Invalidate related cached data together without tracking individual keys.

### Files
- `src/lib/cache-tags.ts` - Tag definitions and helpers
- `src/app/(dashboard)/actions.ts` - Invalidation actions

### Tag Hierarchy

```typescript
// src/lib/cache-tags.ts
export const CacheTags = {
    // User-scoped
    user: (userId) => `user:${userId}`,
    userGroups: (userId) => `user:${userId}:groups`,
    userExpenses: (userId) => `user:${userId}:expenses`,
    userBalances: (userId) => `user:${userId}:balances`,
    
    // Group-scoped
    group: (groupId) => `group:${groupId}`,
    groupExpenses: (groupId) => `group:${groupId}:expenses`,
    groupBalances: (groupId) => `group:${groupId}:balances`,
    groupSettlements: (groupId) => `group:${groupId}:settlements`,
    
    // Global
    allGroups: "all-groups",
    dashboard: "dashboard",
};
```

### Invalidation Helpers

```typescript
// When expense is added
export function revalidateExpenseTags(groupId, paidByUserId, participantIds) {
    // Group caches
    revalidateTag(CacheTags.groupExpenses(groupId));
    revalidateTag(CacheTags.groupBalances(groupId));
    
    // Global caches
    revalidateTag(CacheTags.allExpenses);
    revalidateTag(CacheTags.dashboard);
    
    // Affected users
    revalidateTag(CacheTags.userExpenses(paidByUserId));
    participantIds.forEach(id => {
        revalidateTag(CacheTags.userExpenses(id));
        revalidateTag(CacheTags.userBalances(id));
    });
}
```

### Usage with Next.js unstable_cache

```typescript
// src/services/groups.cached.server.ts
async getGroups(userId) {
    const getCachedGroups = unstable_cache(
        () => groupsServerService.getGroups(userId),
        [`user-groups-${userId}`],
        {
            tags: [
                CacheTags.userGroups(userId),
                CacheTags.allGroups,
            ],
            revalidate: 300,
        }
    );
    
    return getCachedGroups();
}
```

### Important Limitation: unstable_cache and cookies()

**`unstable_cache()` cannot be used with functions that call `cookies()`** (like our Supabase server client).

```typescript
// ❌ THIS WILL ERROR
const getCachedGroups = unstable_cache(
    async () => {
        const supabase = await createClient();  // Uses cookies()
        return supabase.from("groups").select("*");
    },
    ["groups"]
);

// ✅ USE REDIS CACHING INSTEAD
return cached(
    "user:123:groups",
    () => groupsServerService.getGroups(userId),
    CacheTTL.MEDIUM
);
```

### Our Strategy

We use **Redis for caching** and **Next.js tags for invalidation only**:

| Feature | Tool | Purpose |
|---------|------|---------|
| **Caching** | Redis (`cached()`) | Store and retrieve data |
| **Invalidation** | `revalidateTag()` | Invalidate related paths |
| **Path refresh** | `revalidatePath()` | Force page re-render |

```typescript
// src/app/(dashboard)/actions.ts
export async function onExpenseMutation(groupId, paidByUserId, participantIds) {
    // 1. Redis cache invalidation (for cached queries)
    await invalidateGroupCache(groupId);
    
    // 2. Next.js tag invalidation (for related pages)
    revalidateExpenseTags(groupId, paidByUserId, participantIds);
    
    // 3. Path revalidation (force page re-render)
    revalidatePath(`/groups/${groupId}`);
}
```

---

## 4. Optimistic UI

### Purpose
Make the app feel instant by updating UI before server confirms.

### Files
- `src/hooks/use-optimistic-action.ts` - Reusable hooks
- `src/components/features/groups/simplified-debts.tsx` - Example usage

### Hooks

#### useOptimisticAction
For single mutations:

```typescript
const { optimisticData, isPending, execute } = useOptimisticAction({
    data: profile,
    updateFn: (current, input) => ({ ...current, ...input }),
    action: async (input) => await updateProfile(input),
    onSuccess: () => toast.success("Saved!"),
    onError: (error) => toast.error(error),
});
```

#### useOptimisticList
For list operations:

```typescript
const { optimisticItems, addItem, removeItem } = useOptimisticList({
    items: expenses,
    action: async (action) => {
        if (action.type === 'remove') {
            return deleteExpense(action.id);
        }
    },
});
```

#### useOptimisticToggle
For boolean toggles:

```typescript
const { isActive, toggle } = useOptimisticToggle({
    initialState: isSettled,
    action: async (newState) => markSettled(newState),
});
```

### Example: Settlement Button

```typescript
// src/components/features/groups/simplified-debts.tsx
const [settledPayments, setOptimisticSettled] = useOptimistic(
    new Set<string>(),
    (current, paymentKey) => new Set([...current, paymentKey])
);

const handleSettle = (payment) => {
    startTransition(async () => {
        // UI updates INSTANTLY
        setOptimisticSettled(paymentKey);
        
        // Server call in background
        const result = await recordSettlement(...);
        
        if (!result.success) {
            // React auto-reverts optimistic state
            showError(result.error);
        }
    });
};
```

### User Experience

| Before (Traditional) | After (Optimistic) |
|---------------------|-------------------|
| Click → Spinner (500ms) → Update | Click → Instant Update |
| User waits | User continues |
| Error → Show message | Error → Revert + Show message |

---

## 5. Compression

### Purpose
Reduce Redis memory usage and network transfer for large data.

### Files
- `src/lib/compression.ts` - Compression utilities
- `src/lib/cache.ts` - Integration with caching

### Configuration

```typescript
// src/lib/compression.ts
const COMPRESSION_THRESHOLD = 1024;  // Only compress > 1KB
const COMPRESSION_LEVEL = 6;         // Balance speed vs ratio
const COMPRESSED_PREFIX = "__GZIP__";
```

### How It Works

**Write:**
```typescript
function compressIfNeeded<T>(data: T): string {
    const json = JSON.stringify(data);
    
    if (Buffer.byteLength(json) < COMPRESSION_THRESHOLD) {
        return json;  // Skip small data
    }
    
    const compressed = gzipSync(json, { level: 6 });
    const base64 = compressed.toString("base64");
    
    // Only use if actually smaller
    if (base64.length < json.length) {
        return COMPRESSED_PREFIX + base64;
    }
    
    return json;
}
```

**Read:**
```typescript
function decompressIfNeeded<T>(data: string): T {
    if (!data.startsWith(COMPRESSED_PREFIX)) {
        return JSON.parse(data);  // Not compressed
    }
    
    const base64 = data.slice(COMPRESSED_PREFIX.length);
    const buffer = Buffer.from(base64, "base64");
    const decompressed = gunzipSync(buffer);
    
    return JSON.parse(decompressed.toString());
}
```

### Savings

| Data Type | Original | Compressed | Savings |
|-----------|----------|------------|---------|
| Groups list (20) | 50KB | ~8KB | 84% |
| Expenses (100) | 100KB | ~15KB | 85% |
| Analytics | 30KB | ~5KB | 83% |
| Profile | 2KB | (skipped) | N/A |

### Cache Entry Format

```typescript
// Uncompressed (small data)
{
    data: { id: "123", name: "Trip" },
    timestamp: 1702745200000,
}

// Compressed (large data)
{
    data: "__GZIP__H4sIAAAAAAAAA6tW...",
    timestamp: 1702745200000,
    compressed: true,
}
```

---

## Testing & Monitoring

### API Endpoints

#### Health Check
```bash
GET /api/cache/health

# Response
{
    "status": "healthy",
    "redis": "connected",
    "latency": "12ms"
}
```

#### Cache Stats (Dev Only)
```bash
GET /api/cache/stats

# Response
{
    "totalKeys": 45,
    "compression": {
        "threshold": "1 KB",
        "compressedKeys": 15,
        "uncompressedKeys": 30,
        "estimatedSavings": "~80%"
    },
    "sampleKeys": [
        { "key": "group:abc:expenses", "size": "8.2 KB", "compressed": true },
        { "key": "user:xyz:profile", "size": "0.8 KB", "compressed": false }
    ]
}
```

#### Rate Limit Test
```bash
GET /api/rate-limit/test

# Check response headers:
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1702745200000
```

### Testing Rate Limiting

```bash
# Hit endpoint 110 times quickly
for i in {1..110}; do 
    curl -s -o /dev/null -w "%{http_code}\n" \
        http://localhost:3000/api/rate-limit/test
done

# Expected: First 100 return 200, rest return 429
```

### Monitoring Checklist

- [ ] Upstash Dashboard: Check Redis memory usage
- [ ] Upstash Analytics: View rate limit hits
- [ ] Vercel Analytics: Monitor function execution times
- [ ] Error logs: Watch for circuit breaker opens

---

## Configuration

### Environment Variables

```bash
# Required for caching
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxx...

# Already set for Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### Upstash Setup

1. Create account at [console.upstash.com](https://console.upstash.com)
2. Create new Redis database
3. Copy REST URL and Token
4. Add to `.env.local` and Vercel environment variables

### Tuning Parameters

| Parameter | Location | Default | Adjust When |
|-----------|----------|---------|-------------|
| `COMPRESSION_THRESHOLD` | compression.ts | 1KB | Change based on average payload size |
| `COMPRESSION_LEVEL` | compression.ts | 6 | Higher = better ratio, slower |
| `STALE_RATIO` | cache.ts | 0.8 | Lower = fresher data, more DB hits |
| `JITTER_PERCENT` | cache.ts | 0.1 | Higher = more spread in expiration |
| `failureThreshold` | redis.ts | 5 | Lower = faster circuit break |
| `resetTimeout` | redis.ts | 60s | Higher = longer recovery time |

---

---

## 6. Distributed Locking (Race Condition Prevention)

### Purpose
Prevent race conditions in critical operations where concurrent requests could cause data inconsistency.

### File
- `src/lib/distributed-lock.ts` - Lock utilities

### The Problem

```
User A and User B click "Settle" at the same millisecond:

Server A: Check if settled? → No → Process settlement
Server B: Check if settled? → No → Process settlement (RACE!)

Result: Double settlement recorded 💥
```

### The Solution: Distributed Locking

```typescript
// src/lib/distributed-lock.ts

export async function withLock<T>(
    key: string,
    fn: () => Promise<T>,
    options?: LockOptions
): Promise<T> {
    const { acquired, lockId } = await acquireLock(key, options);
    
    if (!acquired) {
        throw new Error("Resource is currently being processed");
    }
    
    try {
        return await fn();
    } finally {
        await releaseLock(key, lockId);
    }
}
```

### Lock Keys

```typescript
export const LockKeys = {
    // Settlement between two users
    settlement: (groupId, fromUser, toUser) =>
        `settlement:${groupId}:${fromUser}:${toUser}`,
    
    // Expense operations
    expense: (groupId, expenseId) =>
        `expense:${groupId}:${expenseId}`,
    
    // Group membership changes
    membership: (groupId, userId) =>
        `membership:${groupId}:${userId}`,
};
```

### Usage in Settlement

```typescript
// src/services/groups.ts
async recordSettlement(groupId, fromUserId, toUserId, amount, ...) {
    return withLock(
        LockKeys.settlement(groupId, fromUserId, toUserId),
        async () => {
            // CRITICAL SECTION - only one request can be here at a time
            
            // 1. Check if already settled
            // 2. Process settlement
            // 3. Update balances
            
            return this._recordSettlementInternal(...);
        },
        { ttl: 15 }  // Lock expires after 15s (safety net)
    );
}
```

### How It Works

```
Request A                              Request B
    │                                      │
    ▼                                      ▼
┌─────────────────┐                ┌─────────────────┐
│ Try acquire     │                │ Try acquire     │
│ lock:settle:A:B │                │ lock:settle:A:B │
└────────┬────────┘                └────────┬────────┘
         │                                  │
         ▼                                  ▼
    ┌─────────┐                       ┌─────────┐
    │ Got it! │                       │ Blocked │ ← Lock exists
    └────┬────┘                       └────┬────┘
         │                                  │
         ▼                                  ▼
   Process Settlement               Wait 100ms, retry
         │                                  │
         ▼                                  ▼
   Release lock                     Still blocked...
         │                                  │
         ▼                                  ▼
      Done                          Eventually get lock
                                    (or timeout after 5 retries)
```

### Configuration

```typescript
const DEFAULT_OPTIONS = {
    ttl: 10,           // Lock auto-expires in 10 seconds
    retryDelay: 100,   // Wait 100ms between retry attempts
    maxRetries: 5,     // Give up after 5 failed attempts
};
```

### Fail-Open Behavior

If Redis is unavailable, locks are bypassed (operation proceeds without protection):

```typescript
if (!redis) {
    console.warn("Redis unavailable, proceeding without lock");
    return { acquired: true, lockId: null };
}
```

---

## 7. CDN Graceful Degradation (Stale-If-Error)

### Purpose
Serve stale data from CDN when backend is completely unavailable, preventing "white screen of death" during outages.

### File
- `src/lib/cache-headers.ts` - Cache header utilities

### The Problem

```
Total Blackout Scenario:
─────────────────────────
1. AWS us-east-1 goes down
2. Supabase is unreachable
3. Redis is down
4. User refreshes page

Without stale-if-error: User sees "500 Error" or white screen 😱
With stale-if-error: User sees last cached page from CDN ✅
```

### The Solution: Cache-Control Headers

```typescript
// src/lib/cache-headers.ts

export const CACHE_PROFILES = {
    "public-dynamic": {
        maxAge: 60,                // Fresh for 1 minute
        staleWhileRevalidate: 300, // Serve stale while refetching (5 min)
        staleIfError: 86400,       // Serve stale if backend DEAD (1 day!)
    },
};

// Generates:
// Cache-Control: public, s-maxage=60, stale-while-revalidate=300, stale-if-error=86400
```

### Cache Profiles

| Profile | maxAge | stale-while-revalidate | stale-if-error | Use Case |
|---------|--------|------------------------|----------------|----------|
| `public-static` | 1 hour | 1 day | 1 week | Config, landing pages |
| `public-dynamic` | 1 min | 5 min | 1 day | Health checks, stats |
| `public-realtime` | 10 sec | 30 sec | 1 hour | Live data |
| `private` | 0 | 0 | 0 | User-specific data |
| `no-store` | - | - | - | Auth, payments |

### Usage in API Routes

```typescript
// src/app/api/health/route.ts
import { getCacheHeaders } from "@/lib/cache-headers";

export async function GET() {
    const data = await checkHealth();
    
    return NextResponse.json(data, {
        headers: getCacheHeaders("public-dynamic"),
    });
}
```

### What Happens During Outage

```
Timeline with stale-if-error=86400:
───────────────────────────────────

2:00 PM - Backend healthy, CDN caches response
2:30 PM - Backend goes down
2:35 PM - User requests /api/health
          │
          ▼
      ┌─────────────┐
      │ Vercel CDN  │
      │ checks cache│
      └──────┬──────┘
             │
             ▼
      ┌─────────────┐
      │ Try backend │ ──────▶ TIMEOUT/ERROR
      └──────┬──────┘
             │
             ▼
      ┌─────────────┐
      │ Has stale?  │ ──────▶ YES (from 2:00 PM)
      └──────┬──────┘
             │
             ▼
      ┌─────────────┐
      │ Serve stale │ ──────▶ User sees data! ✅
      └─────────────┘

Without stale-if-error:
          │
          ▼
      ┌─────────────┐
      │ Return 502  │ ──────▶ User sees error 😱
      └─────────────┘
```

### Which Endpoints Use This?

| Endpoint | Profile | Reason |
|----------|---------|--------|
| `/api/health` | public-dynamic | Monitoring tools need uptime |
| `/api/cache/health` | public-dynamic | Redis status check |
| `/api/feedback` (GET) | public-dynamic | Public data |
| Dashboard pages | private | User-specific, no CDN caching |
| `/api/auth/*` | no-store | Security critical |

### Important Limitations

1. **Only works for public data** - CDN can't cache authenticated responses
2. **Only works for GET requests** - POST/PUT/DELETE always hit origin
3. **Stale data has limits** - 1 day max for most dynamic endpoints
4. **Headers must be set** - Requires explicit `getCacheHeaders()` call

### Testing

```bash
# Check cache headers
curl -I http://localhost:3000/api/health

# Expected:
# Cache-Control: public, s-maxage=60, stale-while-revalidate=300, stale-if-error=86400
# Vary: Accept-Encoding
```

---

## 8. Cache Versioning (Safe Deployments)

### Purpose
Prevent application crashes when cached data structure doesn't match new code expectations.

### File
- `src/lib/cache.ts` - Version constants and helpers

### The Problem

```
Deploy Timeline:
────────────────
1. Old code caches: { name: "John" }
2. Deploy new code expecting: { firstName: "John", lastName: "Doe" }
3. User refreshes page
4. Redis returns old cache: { name: "John" }
5. New code: user.firstName.toUpperCase() → 💥 CRASH
```

### The Solution: Per-Data-Type Versioning

Instead of one global version, each data type has its own version:

```typescript
// src/lib/cache.ts

export const DATA_VERSIONS = {
    groups: "v1",       // Group details, members
    balances: "v1",     // Balance calculations
    settlements: "v1",  // Settlement records
    expenses: "v1",     // Expense lists
    analytics: "v1",    // Charts, trends
    users: "v1",        // User profiles
    dashboard: "v1",    // Dashboard data
    activity: "v1",     // Activity feeds
};
```

### Benefits Over Global Version

| Approach | Change balance calculation | Result |
|----------|---------------------------|--------|
| **Global version** | Bump v1 → v2 | ALL caches invalidated 😢 |
| **Per-type version** | Bump balances v1 → v2 | Only balance caches invalidated ✅ |

### How Keys Are Versioned

```typescript
// CacheKeys automatically apply the right version:
CacheKeys.groupDetails("123")     → "groups-v1:group:123:details"
CacheKeys.groupBalances("123")    → "balances-v1:group:123:balances"
CacheKeys.userProfile("456")      → "users-v1:user:456:profile"
CacheKeys.groupAnalytics("123")   → "analytics-v1:group:123:analytics"
```

### When to Bump (Per Type)

```typescript
// Changed balance calculation?
DATA_VERSIONS = {
    groups: "v1",       // unchanged
    balances: "v2",     // ← BUMP THIS ONLY
    expenses: "v1",     // unchanged
    // ...
};

// Result:
// - Balance caches: invalidated (v1 → v2)
// - Group caches: still warm! ✅
// - Expense caches: still warm! ✅
```

### Auto-Detection for Raw Keys

Raw keys are auto-versioned based on their pattern:

```typescript
cached("group:123:balances", fetcher);
// Auto-detected as "balances" type
// Versioned to: "balances-v1:group:123:balances"

cached("user:456:profile", fetcher);
// Auto-detected as "users" type
// Versioned to: "users-v1:user:456:profile"
```

---

## 9. Bundle Analysis (Tree Shaking)

### Purpose
Identify oversized dependencies and optimize JavaScript bundle size for faster page loads.

### Setup

```bash
npm install @next/bundle-analyzer --save-dev
```

### Configuration

```typescript
// next.config.ts
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

export default withBundleAnalyzer(nextConfig);
```

### NPM Scripts

```bash
npm run analyze          # Analyze both client and server bundles
npm run analyze:server   # Server bundle only
npm run analyze:browser  # Browser bundle only
```

### Running Analysis

```bash
npm run analyze
```

This generates interactive HTML reports in `.next/analyze/`:
- `client.html` - Browser bundles
- `nodejs.html` - Server bundles

### What to Look For

| Red Flag | Problem | Solution |
|----------|---------|----------|
| Large `lodash` | Importing entire library | Use `lodash-es` or specific imports: `import debounce from 'lodash/debounce'` |
| Heavy charts on homepage | Shipping unused code | Use `next/dynamic` with `ssr: false` |
| Duplicate dependencies | Same code bundled twice | Check `npm ls <package>` for version conflicts |
| Large icons | Full icon library | Import specific icons: `import { Menu } from 'lucide-react'` |
| Moment.js | 300KB+ with locales | Use `date-fns` (tree-shakeable) ✅ We already do this |

### Lazy Loading Heavy Components

```typescript
// ❌ BAD: Charts loaded on every page
import { BarChart } from 'recharts';

// ✅ GOOD: Charts loaded only when needed
import dynamic from 'next/dynamic';

const BarChart = dynamic(
  () => import('recharts').then(mod => mod.BarChart),
  { 
    ssr: false,
    loading: () => <Spinner />
  }
);
```

### Current Bundle Status

| Package | Size | Status | Notes |
|---------|------|--------|-------|
| `recharts` | ~200KB | ⚠️ Large | Only loaded on analytics page |
| `@supabase/supabase-js` | ~50KB | ✅ OK | Core dependency |
| `date-fns` | ~15KB | ✅ OK | Tree-shakeable |
| `lucide-react` | ~5KB | ✅ OK | Individual icon imports |
| `zod` | ~15KB | ✅ OK | Validation library |
| `react-hook-form` | ~25KB | ✅ OK | Form handling |

### Optimization Checklist

- [ ] Run `npm run analyze` after adding new dependencies
- [ ] Use dynamic imports for heavy components not needed on initial load
- [ ] Check for duplicate dependencies with `npm ls`
- [ ] Prefer smaller alternatives (date-fns over moment, etc.)
- [ ] Import only what you need from large libraries

### Example Report

```
Route (app)                    Size     First Load JS
─────────────────────────────────────────────────────
├ ○ /                         5.2 kB        89 kB
├ ○ /dashboard               12.3 kB        96 kB
├ ƒ /groups/[id]              8.1 kB        92 kB
├ ƒ /groups/[id]/analytics   45.2 kB       129 kB  ← recharts loaded here
└ ○ /login                    3.4 kB        87 kB

+ First Load JS shared by all: 84 kB
```

---

## Summary

| Feature | Problem Solved | Key Benefit |
|---------|---------------|-------------|
| **Redis Caching** | Slow DB queries | 10-100x faster reads |
| **Circuit Breaker** | Redis failures crash app | Graceful degradation |
| **SWR Pattern** | Stale data vs slow response | Best of both worlds |
| **Rate Limiting** | DDoS, cost overrun | Protection + fair usage |
| **Tag Invalidation** | Complex cache management | Simple, semantic invalidation |
| **Optimistic UI** | Perceived latency | 0ms perceived response |
| **Compression** | Redis memory/bandwidth | ~80% cost reduction |
| **CDN Stale-If-Error** | Total backend outage | White screen → stale page |
| **Distributed Locks** | Race conditions | Data consistency |
| **Cache Versioning** | Corrupted cache on deploy | Safe deployments |
| **Bundle Analysis** | Bloated JS bundles | Faster page loads |

### Design Principles Applied

1. **Fail Open** - System works without Redis (just slower)
2. **Defense in Depth** - Multiple layers of protection
3. **Graceful Degradation** - Features disable progressively
4. **Separation of Concerns** - Each utility does one thing well
5. **Developer Experience** - Simple APIs, automatic optimization

