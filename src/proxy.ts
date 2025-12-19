import { type NextRequest, NextResponse } from "next/server";
// NOTE: updateSession removed - Next.js 16 proxy can't modify cookies
// Auth is now handled at page level via Server Components
import { checkRateLimit, getClientIP, createRateLimitHeaders } from "@/lib/rate-limit";
import { analyzeRequest } from "@/lib/security-monitor";
import { logger, generateRequestId } from "@/lib/logger";

// ============================================
// RATE LIMIT CONFIGURATION BY PATH
// ============================================

type RateLimitType = "api" | "auth" | "sensitive" | "public" | "expensive" | "invite";

interface PathRateLimit {
    pattern: RegExp;
    type: RateLimitType;
}

// Define rate limits for different path patterns
// ORDER MATTERS: More specific patterns should come first
const pathRateLimits: PathRateLimit[] = [
    // ============================================
    // SECURITY: Strict limits for brute-forceable endpoints
    // ============================================
    
    // Invite code endpoints - VERY strict to prevent brute force
    { pattern: /^\/api\/groups\/preview/, type: "invite" },  // Invite code validation
    { pattern: /^\/groups\/join/, type: "invite" },          // Join group page
    
    // Auth endpoints - strict limits (brute force protection)
    { pattern: /^\/login/, type: "auth" },
    { pattern: /^\/register/, type: "auth" },
    { pattern: /^\/api\/auth/, type: "auth" },
    { pattern: /^\/auth\/callback/, type: "auth" },
    
    // Sensitive operations
    { pattern: /^\/forgot-password/, type: "sensitive" },
    { pattern: /^\/reset-password/, type: "sensitive" },
    
    // ============================================
    // Standard limits
    // ============================================
    
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
// PROXY (Next.js 16 Middleware)
// ============================================

export async function proxy(request: NextRequest) {
    const pathname = request.nextUrl.pathname;
    const requestId = generateRequestId();
    const startTime = Date.now();
    
    // Skip rate limiting and security analysis for static assets, SEO files, and auth pages
    if (
        pathname.startsWith("/_next/") ||
        pathname.startsWith("/favicon") ||
        pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico)$/) ||
        // SEO-critical files - must be accessible to crawlers
        pathname === "/sitemap.xml" ||
        pathname === "/robots.txt" ||
        pathname.startsWith("/google") || // Google verification files
        // Auth pages - temporarily disabled rate limiting
        pathname.startsWith("/login") ||
        pathname.startsWith("/register") ||
        pathname.startsWith("/forgot-password") ||
        pathname.startsWith("/reset-password") ||
        pathname.startsWith("/auth/callback")
    ) {
        return NextResponse.next();
    }

    // Get client identifier (IP address)
    const clientIP = getClientIP(request);
    const userAgent = request.headers.get("user-agent");
    
    // ============================================
    // SECURITY ANALYSIS
    // ============================================
    
    // Only analyze non-static routes and API routes for performance
    const shouldAnalyze = pathname.startsWith("/api/") || 
                          pathname.startsWith("/login") || 
                          pathname.startsWith("/register") ||
                          pathname.startsWith("/groups/join");
    
    if (shouldAnalyze) {
        const analysis = await analyzeRequest({
            ipAddress: clientIP,
            userAgent,
            path: pathname,
            method: request.method,
        });
        
        // Block if suspicious and should block
        if (analysis.shouldBlock) {
            logger.warn(`Request blocked: ${analysis.reasons.join(", ")}`, {
                requestId,
                path: pathname,
                ip: clientIP,
            });
            
            return new NextResponse(
                JSON.stringify({
                    error: "Request Blocked",
                    message: "Your request has been blocked for security reasons.",
                    requestId,
                }),
                {
                    status: 403,
                    headers: {
                        "Content-Type": "application/json",
                        "X-Request-Id": requestId,
                    },
                }
            );
        }
    }
    
    // ============================================
    // RATE LIMITING
    // ============================================
    
    // Determine rate limit type based on path
    const rateLimitType = getRateLimitType(pathname);
    
    // Check rate limit
    const rateLimitResult = await checkRateLimit(
        `${clientIP}:${rateLimitType}`,
        rateLimitType
    );

    // If rate limited, return 429 Too Many Requests
    if (!rateLimitResult.success) {
        logger.warn(`Rate limit exceeded: ${pathname}`, {
            requestId,
            type: rateLimitType,
            ip: clientIP,
        });
        
        return new NextResponse(
            JSON.stringify({
                error: "Too Many Requests",
                message: `Rate limit exceeded. Please try again in ${rateLimitResult.retryAfter} seconds.`,
                retryAfter: rateLimitResult.retryAfter,
                requestId,
            }),
            {
                status: 429,
                headers: {
                    "Content-Type": "application/json",
                    "X-Request-Id": requestId,
                    ...createRateLimitHeaders(rateLimitResult),
                },
            }
        );
    }

    // ============================================
    // CONTINUE REQUEST
    // ============================================
    
    // Create response (auth handled at page level, not in proxy)
    const response = NextResponse.next();
    
    // Add rate limit headers to response
    const rateLimitHeaders = createRateLimitHeaders(rateLimitResult);
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value as string);
    });
    response.headers.set("X-Request-Id", requestId);
    
    // Log request (only for API routes to avoid noise)
    if (pathname.startsWith("/api/")) {
        const duration = Date.now() - startTime;
        logger.request(
            request.method,
            pathname,
            response.status,
            duration,
            { requestId, ip: clientIP }
        );
    }

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

