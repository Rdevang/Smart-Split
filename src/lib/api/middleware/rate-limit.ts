/**
 * Rate Limiting Middleware
 * 
 * Provides rate limiting middleware for the route builder.
 * Wraps the existing rate-limit.ts implementation.
 * 
 * USAGE:
 *   // Rate limit by IP (default)
 *   createRoute()
 *       .use(withRateLimit("api"))
 *       .handler(...)
 *   
 *   // Rate limit by user ID (requires auth first)
 *   createRoute()
 *       .use(withAuth())
 *       .use(withRateLimitByUser("api"))
 *       .handler(...)
 */

import type { BaseContext, Middleware, AuthContext } from "../route-builder";
import {
    checkRateLimit,
    getClientIP,
    createRateLimitHeaders,
    RateLimitConfig,
    type RateLimitResult
} from "@/lib/rate-limit";
import { ApiError } from "@/lib/api-responses";
import { NextResponse } from "next/server";

// ============================================
// TYPES
// ============================================

/**
 * Rate limit types (from config)
 */
export type RateLimitType = keyof typeof RateLimitConfig;

/**
 * Context with rate limit info
 */
export interface RateLimitContext extends BaseContext {
    rateLimit: RateLimitResult;
}

/**
 * Options for rate limiting
 */
export interface RateLimitOptions {
    /** Custom identifier function */
    getIdentifier?: (ctx: BaseContext) => string;
    /** Whether to add rate limit headers to response */
    addHeaders?: boolean;
}

// ============================================
// MIDDLEWARE
// ============================================

/**
 * Rate limit by client IP address
 * 
 * Adds `rateLimit` info to context for inspection.
 * Returns 429 if rate limit exceeded.
 * 
 * USAGE:
 *   createRoute()
 *       .use(withRateLimit("api"))
 *       .handler(async (ctx) => {
 *           // ctx.rateLimit has limit info
 *       });
 */
export function withRateLimit(
    type: RateLimitType = "api",
    options: RateLimitOptions = {}
): Middleware<BaseContext, RateLimitContext> {
    const { getIdentifier, addHeaders = true } = options;

    return async (ctx) => {
        // Get identifier (custom or IP-based)
        const identifier = getIdentifier
            ? getIdentifier(ctx)
            : getClientIP(ctx.request);

        // Check rate limit
        const result = await checkRateLimit(identifier, type);

        if (!result.success) {
            // Return 429 with appropriate headers
            const headers = addHeaders ? createRateLimitHeaders(result) : {};

            return NextResponse.json(
                {
                    error: "Too many requests. Please try again later.",
                    code: "RATE_LIMITED",
                    retryAfter: result.retryAfter,
                },
                {
                    status: 429,
                    headers,
                }
            );
        }

        return {
            ...ctx,
            rateLimit: result,
        };
    };
}

/**
 * Rate limit by authenticated user ID
 * 
 * MUST be used after withAuth() - requires ctx.user.
 * More accurate than IP-based limiting for authenticated users.
 * 
 * USAGE:
 *   createRoute()
 *       .use(withAuth())
 *       .use(withRateLimitByUser("api"))
 *       .handler(...)
 */
export function withRateLimitByUser(
    type: RateLimitType = "api"
): Middleware<AuthContext, AuthContext & RateLimitContext> {
    return async (ctx) => {
        // Use user ID as identifier
        const identifier = `user:${ctx.user.id}`;

        // Check rate limit
        const result = await checkRateLimit(identifier, type);

        if (!result.success) {
            return NextResponse.json(
                {
                    error: "Too many requests. Please try again later.",
                    code: "RATE_LIMITED",
                    retryAfter: result.retryAfter,
                },
                {
                    status: 429,
                    headers: createRateLimitHeaders(result),
                }
            );
        }

        return {
            ...ctx,
            rateLimit: result,
        };
    };
}

/**
 * Rate limit combining IP and user ID
 * 
 * Applies two rate limits:
 * 1. By IP (to catch multiple users behind same IP)
 * 2. By user ID (to catch single user from multiple IPs)
 * 
 * USAGE:
 *   createRoute()
 *       .use(withAuth())
 *       .use(withRateLimitCombined("api"))
 *       .handler(...)
 */
export function withRateLimitCombined(
    type: RateLimitType = "api"
): Middleware<AuthContext, AuthContext & RateLimitContext> {
    return async (ctx) => {
        const ip = getClientIP(ctx.request);

        // Check both limits
        const [ipResult, userResult] = await Promise.all([
            checkRateLimit(`ip:${ip}`, type),
            checkRateLimit(`user:${ctx.user.id}`, type),
        ]);

        // If either limit exceeded, return 429
        if (!ipResult.success) {
            return NextResponse.json(
                {
                    error: "Too many requests from your network.",
                    code: "RATE_LIMITED",
                    retryAfter: ipResult.retryAfter,
                },
                {
                    status: 429,
                    headers: createRateLimitHeaders(ipResult),
                }
            );
        }

        if (!userResult.success) {
            return NextResponse.json(
                {
                    error: "Too many requests. Please try again later.",
                    code: "RATE_LIMITED",
                    retryAfter: userResult.retryAfter,
                },
                {
                    status: 429,
                    headers: createRateLimitHeaders(userResult),
                }
            );
        }

        // Return the more restrictive result for context
        const moreRestrictive = ipResult.remaining < userResult.remaining
            ? ipResult
            : userResult;

        return {
            ...ctx,
            rateLimit: moreRestrictive,
        };
    };
}

/**
 * Cron job protection
 * 
 * Verifies cron secret from environment variable.
 * Used for protecting scheduled endpoints.
 * 
 * USAGE:
 *   createRoute()
 *       .use(withCronAuth())
 *       .handler(...)
 */
export function withCronAuth(): Middleware<BaseContext, BaseContext & { isCron: true }> {
    return async (ctx) => {
        const authHeader = ctx.request.headers.get("authorization");
        const cronSecret = process.env.CRON_SECRET;

        // If no secret configured, allow in development only
        if (!cronSecret) {
            if (process.env.NODE_ENV === "development") {
                return { ...ctx, isCron: true as const };
            }
            return ApiError.unauthorized("Cron secret not configured");
        }

        if (authHeader !== `Bearer ${cronSecret}`) {
            return ApiError.unauthorized("Invalid cron secret");
        }

        return { ...ctx, isCron: true as const };
    };
}
