import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { checkRateLimit, getClientIP, createRateLimitHeaders } from "@/lib/rate-limit";

// ============================================
// RATE LIMIT CONFIGURATION BY PATH
// ============================================

type RateLimitType = "api" | "auth" | "sensitive" | "public" | "expensive";

interface PathRateLimit {
    pattern: RegExp;
    type: RateLimitType;
}

// Define rate limits for different path patterns
const pathRateLimits: PathRateLimit[] = [
    // Auth endpoints - strict limits (brute force protection)
    { pattern: /^\/login/, type: "auth" },
    { pattern: /^\/register/, type: "auth" },
    { pattern: /^\/api\/auth/, type: "auth" },
    { pattern: /^\/auth\/callback/, type: "auth" },
    
    // Sensitive operations
    { pattern: /^\/forgot-password/, type: "sensitive" },
    { pattern: /^\/reset-password/, type: "sensitive" },
    
    // Public endpoints
    { pattern: /^\/feedback/, type: "public" },
    { pattern: /^\/api\/feedback/, type: "public" },
    
    // Expensive operations (analytics, etc.)
    { pattern: /^\/groups\/[^/]+\/analytics/, type: "expensive" },
    { pattern: /^\/api\/cache/, type: "expensive" },
    
    // API routes - moderate limits
    { pattern: /^\/api\//, type: "api" },
];

/**
 * Get the rate limit type for a given path
 */
function getRateLimitType(pathname: string): RateLimitType {
    for (const { pattern, type } of pathRateLimits) {
        if (pattern.test(pathname)) {
            return type;
        }
    }
    return "api"; // Default rate limit
}

// ============================================
// PROXY (MIDDLEWARE)
// ============================================

export async function proxy(request: NextRequest) {
    const pathname = request.nextUrl.pathname;
    
    // Skip rate limiting for static assets
    if (
        pathname.startsWith("/_next/") ||
        pathname.startsWith("/favicon") ||
        pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico)$/)
    ) {
        return NextResponse.next();
    }

    // Get client identifier (IP address)
    const clientIP = getClientIP(request);
    
    // Determine rate limit type based on path
    const rateLimitType = getRateLimitType(pathname);
    
    // Check rate limit
    const rateLimitResult = await checkRateLimit(
        `${clientIP}:${rateLimitType}`,
        rateLimitType
    );

    // If rate limited, return 429 Too Many Requests
    if (!rateLimitResult.success) {
        return new NextResponse(
            JSON.stringify({
                error: "Too Many Requests",
                message: `Rate limit exceeded. Please try again in ${rateLimitResult.retryAfter} seconds.`,
                retryAfter: rateLimitResult.retryAfter,
            }),
            {
                status: 429,
                headers: {
                    "Content-Type": "application/json",
                    ...createRateLimitHeaders(rateLimitResult),
                },
            }
        );
    }

    // Continue with Supabase session handling
    const response = await updateSession(request);
    
    // Add rate limit headers to response
    const rateLimitHeaders = createRateLimitHeaders(rateLimitResult);
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value as string);
    });

    return response;
}

// ============================================
// MATCHER - Which paths to run middleware on
// ============================================

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico
         * - Static assets (svg, png, jpg, etc.)
         */
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
    ],
};

