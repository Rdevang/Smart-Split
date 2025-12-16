// ============================================
// CDN CACHE HEADERS (Graceful Degradation)
// ============================================
// Configures Vercel Edge/CDN to serve stale data when backend is down.
// This prevents "white screen of death" during outages.
//
// Cache-Control directives:
// - s-maxage: How long CDN considers data "fresh"
// - stale-while-revalidate: Serve stale while fetching new in background
// - stale-if-error: Serve stale if backend returns error (graceful degradation!)
//
// IMPORTANT: Only use for PUBLIC data that's safe to cache at CDN level.
// User-specific/authenticated data should NOT use these headers.

export type CacheProfile = 
    | "public-static"      // Rarely changes (e.g., app config)
    | "public-dynamic"     // Changes frequently but public (e.g., public stats)
    | "public-realtime"    // Changes often, minimal caching
    | "private"            // User-specific, no CDN caching
    | "no-store";          // Never cache (sensitive data)

interface CacheConfig {
    maxAge: number;           // s-maxage: fresh duration (seconds)
    staleWhileRevalidate: number;  // Serve stale while refetching
    staleIfError: number;     // Serve stale if backend error (graceful degradation)
    isPublic: boolean;        // Can CDN cache this?
}

const CACHE_PROFILES: Record<CacheProfile, CacheConfig> = {
    // Static public content - cache aggressively
    "public-static": {
        maxAge: 3600,              // Fresh for 1 hour
        staleWhileRevalidate: 86400,  // Serve stale for 1 day while refetching
        staleIfError: 604800,      // Serve stale for 1 week if backend down!
        isPublic: true,
    },
    
    // Dynamic public content - moderate caching
    "public-dynamic": {
        maxAge: 60,                // Fresh for 1 minute
        staleWhileRevalidate: 300, // Serve stale for 5 mins while refetching
        staleIfError: 86400,       // Serve stale for 1 day if backend down
        isPublic: true,
    },
    
    // Realtime public content - minimal caching
    "public-realtime": {
        maxAge: 10,                // Fresh for 10 seconds
        staleWhileRevalidate: 30,  // Serve stale for 30 secs while refetching
        staleIfError: 3600,        // Serve stale for 1 hour if backend down
        isPublic: true,
    },
    
    // Private user data - no CDN caching, browser only
    "private": {
        maxAge: 0,
        staleWhileRevalidate: 0,
        staleIfError: 0,
        isPublic: false,
    },
    
    // Sensitive data - never cache anywhere
    "no-store": {
        maxAge: 0,
        staleWhileRevalidate: 0,
        staleIfError: 0,
        isPublic: false,
    },
};

/**
 * Generate Cache-Control header value
 * 
 * @example
 * // For public API that can serve stale data during outages
 * return NextResponse.json(data, {
 *     headers: { "Cache-Control": getCacheControl("public-dynamic") }
 * });
 */
export function getCacheControl(profile: CacheProfile): string {
    const config = CACHE_PROFILES[profile];
    
    if (profile === "no-store") {
        return "no-store, no-cache, must-revalidate";
    }
    
    if (!config.isPublic) {
        return "private, no-cache";
    }
    
    const parts = [
        "public",
        `s-maxage=${config.maxAge}`,
        `stale-while-revalidate=${config.staleWhileRevalidate}`,
        `stale-if-error=${config.staleIfError}`,
    ];
    
    return parts.join(", ");
}

/**
 * Get cache headers object for NextResponse
 * 
 * @example
 * return NextResponse.json(data, {
 *     headers: getCacheHeaders("public-dynamic")
 * });
 */
export function getCacheHeaders(profile: CacheProfile): HeadersInit {
    return {
        "Cache-Control": getCacheControl(profile),
        // Vary header tells CDN to cache different versions based on these
        "Vary": "Accept-Encoding",
    };
}

/**
 * Add cache headers to an existing headers object
 */
export function withCacheHeaders(
    headers: Headers | HeadersInit,
    profile: CacheProfile
): Headers {
    const result = new Headers(headers);
    result.set("Cache-Control", getCacheControl(profile));
    result.set("Vary", "Accept-Encoding");
    return result;
}

// ============================================
// USAGE GUIDE
// ============================================
//
// PUBLIC endpoints (safe to cache at CDN):
// ─────────────────────────────────────────
// - /api/health              → public-static
// - /api/cache/health        → public-dynamic
// - /api/feedback (GET)      → public-dynamic
// - Public landing pages     → public-static
//
// PRIVATE endpoints (user-specific):
// ─────────────────────────────────────────
// - /api/groups/*            → private (uses cookies)
// - /api/expenses/*          → private
// - /api/user/*              → private
// - Dashboard pages          → private
//
// NEVER CACHE:
// ─────────────────────────────────────────
// - /api/auth/*              → no-store
// - Password reset           → no-store
// - Payment endpoints        → no-store
//
// ============================================
// WHAT HAPPENS DURING OUTAGE
// ============================================
//
// With stale-if-error=86400 (1 day):
//
// 1. Backend goes down at 2:00 PM
// 2. User requests /api/health at 2:05 PM
// 3. CDN tries to reach backend → timeout/error
// 4. CDN has stale data from 1:30 PM
// 5. CDN serves stale data instead of error!
// 6. User sees "healthy" status (slightly outdated but not an error page)
// 7. This continues until backend recovers OR stale-if-error expires
//
// Without stale-if-error:
// → User sees 500 error or white screen 😱

