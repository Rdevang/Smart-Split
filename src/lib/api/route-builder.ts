/**
 * Route Builder - Composable API Route Handler
 * 
 * Implements Chain of Responsibility + Builder patterns for clean,
 * production-standard API routes.
 * 
 * SOLID Principles:
 * - Single Responsibility: Each middleware handles ONE concern
 * - Open/Closed: Add middleware without modifying existing code
 * - Liskov Substitution: All middleware conform to same interface
 * - Interface Segregation: Context only contains what's needed
 * - Dependency Inversion: Handlers depend on abstract context
 * 
 * USAGE:
 *   import { createRoute, withAuth, withValidation } from "@/lib/api";
 *   
 *   export const GET = createRoute()
 *       .use(withAuth())
 *       .use(withValidation(MySchema))
 *       .handler(async (ctx) => {
 *           return ApiResponse.success(ctx.validated);
 *       });
 */

import { NextRequest, NextResponse } from "next/server";
import { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { apiLog } from "@/lib/console-logger";
import { ApiError } from "@/lib/api-responses";

// ============================================
// TYPES
// ============================================

/**
 * Base context available to all handlers
 */
export interface BaseContext {
    /** The incoming request */
    request: NextRequest;
    /** Route params (for dynamic routes like [id]) */
    params: Record<string, string>;
    /** Supabase client (created lazily) */
    supabase: SupabaseClient;
}

/**
 * Context with authenticated user
 */
export interface AuthContext extends BaseContext {
    user: User;
}

/**
 * Context with optional user (may or may not be authenticated)
 */
export interface OptionalAuthContext extends BaseContext {
    user: User | null;
}

/**
 * Context with validated request body
 */
export interface ValidatedContext<T> extends BaseContext {
    validated: T;
}

/**
 * Context with validated query params
 */
export interface QueryValidatedContext<T> extends BaseContext {
    query: T;
}

/**
 * Middleware function type
 * Takes context and returns either:
 * - Extended context (continue chain)
 * - NextResponse (short-circuit with response)
 */
export type Middleware<TIn extends BaseContext, TOut extends BaseContext> = (
    ctx: TIn
) => Promise<TOut | NextResponse>;

/**
 * Final handler function type
 */
export type Handler<TCtx extends BaseContext> = (
    ctx: TCtx
) => Promise<NextResponse>;

/**
 * Next.js route handler params
 */
export interface RouteParams {
    params: Promise<Record<string, string>>;
}

// ============================================
// ROUTE BUILDER CLASS
// ============================================

/**
 * Fluent builder for composing route handlers
 * 
 * Uses generics to track context type through middleware chain,
 * providing full type safety.
 */
class RouteBuilder<TCtx extends BaseContext = BaseContext> {
    private middlewares: Array<Middleware<BaseContext, BaseContext>> = [];

    /**
     * Add middleware to the chain
     * 
     * Middleware is executed in order. Each middleware can:
     * - Extend the context (add user, validated data, etc.)
     * - Short-circuit by returning a NextResponse
     * - Pass through by returning the context
     */
    use<TNewCtx extends BaseContext>(
        middleware: Middleware<TCtx, TNewCtx>
    ): RouteBuilder<TNewCtx> {
        this.middlewares.push(middleware as unknown as Middleware<BaseContext, BaseContext>);
        return this as unknown as RouteBuilder<TNewCtx>;
    }

    /**
     * Set the final handler and return the Next.js route handler
     * 
     * This is the business logic that runs after all middleware passes.
     */
    handler(fn: Handler<TCtx>): (
        request: NextRequest,
        routeParams?: RouteParams
    ) => Promise<NextResponse> {
        const middlewares = this.middlewares;

        return async (
            request: NextRequest,
            routeParams?: RouteParams
        ): Promise<NextResponse> => {
            try {
                // Resolve params (Next.js 15+ uses Promise)
                const params = routeParams?.params
                    ? await routeParams.params
                    : {};

                // Create Supabase client
                const supabase = await createClient();

                // Build initial context
                let ctx: BaseContext = {
                    request,
                    params,
                    supabase,
                };

                // Run middleware chain
                for (const middleware of middlewares) {
                    const result = await middleware(ctx);

                    // If middleware returns NextResponse, short-circuit
                    if (result instanceof NextResponse) {
                        return result;
                    }

                    // Otherwise, update context and continue
                    ctx = result;
                }

                // Run final handler
                return await fn(ctx as TCtx);

            } catch (error) {
                // Log and return generic error
                apiLog.error("Route handler error", error);
                return ApiError.internal();
            }
        };
    }
}

// ============================================
// FACTORY FUNCTION
// ============================================

/**
 * Create a new route builder
 * 
 * USAGE:
 *   export const GET = createRoute()
 *       .use(withAuth())
 *       .handler(async (ctx) => {
 *           return ApiResponse.success({ user: ctx.user.email });
 *       });
 */
export function createRoute(): RouteBuilder<BaseContext> {
    return new RouteBuilder();
}

// ============================================
// TYPE HELPERS
// ============================================

/**
 * Helper to check if a value is a NextResponse
 */
export function isResponse(value: unknown): value is NextResponse {
    return value instanceof NextResponse;
}

/**
 * Helper to create a middleware that always passes through
 * Useful for conditional middleware
 */
export function passthrough<T extends BaseContext>(): Middleware<T, T> {
    return async (ctx) => ctx;
}

/**
 * Combine multiple middleware into one
 * 
 * USAGE:
 *   const authAndValidate = compose(
 *       withAuth(),
 *       withValidation(MySchema)
 *   );
 */
export function compose<T extends BaseContext>(
    ...middlewares: Array<Middleware<BaseContext, BaseContext>>
): Middleware<T, BaseContext> {
    return async (ctx: T) => {
        let current: BaseContext = ctx;

        for (const middleware of middlewares) {
            const result = await middleware(current);
            if (result instanceof NextResponse) {
                return result;
            }
            current = result;
        }

        return current;
    };
}
