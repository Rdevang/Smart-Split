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

import { createRoute, withRateLimit, ApiResponse } from "@/lib/api";
import { createRateLimitHeaders } from "@/lib/rate-limit";

export const GET = createRoute()
    .use(withRateLimit("api"))
    .handler(async (ctx) => {
        return ApiResponse.success(
            {
                message: "Rate limit test successful",
                timestamp: new Date().toISOString(),
                rateLimit: {
                    limit: ctx.rateLimit.limit,
                    remaining: ctx.rateLimit.remaining,
                    reset: ctx.rateLimit.reset,
                },
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
            },
            createRateLimitHeaders(ctx.rateLimit)
        );
    });
