import { NextResponse } from "next/server";

/**
 * Test endpoint for rate limiting
 * 
 * Hit this endpoint repeatedly to test rate limiting behavior:
 * - Default API limit: 100 requests per minute
 * - Check response headers for rate limit info:
 *   - X-RateLimit-Limit: Maximum requests allowed
 *   - X-RateLimit-Remaining: Requests remaining in window
 *   - X-RateLimit-Reset: Unix timestamp when limit resets
 *   - Retry-After: Seconds until retry allowed (only when limited)
 */
export async function GET() {
    return NextResponse.json({
        message: "Rate limit test successful",
        timestamp: new Date().toISOString(),
        info: {
            description: "This endpoint is rate limited to test the rate limiting system",
            howToTest: "Hit this endpoint repeatedly to see rate limiting in action",
            checkHeaders: [
                "X-RateLimit-Limit",
                "X-RateLimit-Remaining",
                "X-RateLimit-Reset",
                "Retry-After (when limited)",
            ],
        },
    });
}

