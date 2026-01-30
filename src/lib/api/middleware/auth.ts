/**
 * Authentication Middleware
 * 
 * Provides authentication middleware for the route builder.
 * Handles user authentication, optional auth, and admin checks.
 * 
 * USAGE:
 *   // Require authenticated user
 *   createRoute().use(withAuth()).handler(...)
 *   
 *   // Optional auth (user may be null)
 *   createRoute().use(withOptionalAuth()).handler(...)
 *   
 *   // Require admin role
 *   createRoute().use(withAdminAuth()).handler(...)
 */

import type {
    BaseContext,
    AuthContext,
    OptionalAuthContext,
    Middleware
} from "../route-builder";
import { ApiError } from "@/lib/api-responses";

// ============================================
// TYPES
// ============================================

/**
 * Context with admin user
 */
export interface AdminAuthContext extends AuthContext {
    isAdmin: true;
    adminRole: "admin" | "site_admin";
}

// ============================================
// MIDDLEWARE
// ============================================

/**
 * Require authenticated user
 * 
 * Adds `user: User` to context.
 * Returns 401 if not authenticated.
 * 
 * USAGE:
 *   createRoute()
 *       .use(withAuth())
 *       .handler(async (ctx) => {
 *           // ctx.user is User (not null)
 *           return ApiResponse.success({ email: ctx.user.email });
 *       });
 */
export function withAuth(): Middleware<BaseContext, AuthContext> {
    return async (ctx) => {
        const { data: { user }, error } = await ctx.supabase.auth.getUser();

        if (error || !user) {
            return ApiError.unauthorized();
        }

        return {
            ...ctx,
            user,
        };
    };
}

/**
 * Optional authentication
 * 
 * Adds `user: User | null` to context.
 * Never returns error - always passes through.
 * 
 * USAGE:
 *   createRoute()
 *       .use(withOptionalAuth())
 *       .handler(async (ctx) => {
 *           if (ctx.user) {
 *               // Logged in user
 *           } else {
 *               // Anonymous user
 *           }
 *       });
 */
export function withOptionalAuth(): Middleware<BaseContext, OptionalAuthContext> {
    return async (ctx) => {
        const { data: { user } } = await ctx.supabase.auth.getUser();

        return {
            ...ctx,
            user: user || null,
        };
    };
}

/**
 * Require admin role
 * 
 * Adds `user: User`, `isAdmin: true`, and `adminRole` to context.
 * Returns 401 if not authenticated, 403 if not admin.
 * 
 * USAGE:
 *   createRoute()
 *       .use(withAdminAuth())
 *       .handler(async (ctx) => {
 *           // ctx.user is User, ctx.isAdmin is true
 *           // ctx.adminRole is "admin" or "site_admin"
 *       });
 */
export function withAdminAuth(): Middleware<BaseContext, AdminAuthContext> {
    return async (ctx) => {
        // First check authentication
        const { data: { user }, error } = await ctx.supabase.auth.getUser();

        if (error || !user) {
            return ApiError.unauthorized();
        }

        // Check admin role in profile
        const { data: profile } = await ctx.supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();

        const role = profile?.role;

        if (role !== "admin" && role !== "site_admin") {
            return ApiError.forbidden("Admin access required");
        }

        return {
            ...ctx,
            user,
            isAdmin: true as const,
            adminRole: role as "admin" | "site_admin",
        };
    };
}

/**
 * Require specific user ID (for routes like /api/users/[userId])
 * 
 * User can only access their own resource, unless they're admin.
 * 
 * USAGE:
 *   createRoute()
 *       .use(withAuth())
 *       .use(withSelfOrAdmin("userId"))
 *       .handler(async (ctx) => {
 *           // User is either accessing their own resource or is admin
 *       });
 */
export function withSelfOrAdmin(
    paramName: string
): Middleware<AuthContext, AuthContext & { targetUserId: string }> {
    return async (ctx) => {
        const targetUserId = ctx.params[paramName];

        if (!targetUserId) {
            return ApiError.badRequest(`Missing ${paramName} parameter`);
        }

        // Check if user is accessing their own resource
        if (ctx.user.id === targetUserId) {
            return {
                ...ctx,
                targetUserId,
            };
        }

        // Check if user is admin
        const { data: profile } = await ctx.supabase
            .from("profiles")
            .select("role")
            .eq("id", ctx.user.id)
            .single();

        if (profile?.role === "admin" || profile?.role === "site_admin") {
            return {
                ...ctx,
                targetUserId,
            };
        }

        return ApiError.forbidden("You can only access your own resources");
    };
}

// ============================================
// HELPERS
// ============================================

/**
 * Check if user has admin role
 */
export async function isUserAdmin(
    supabase: BaseContext["supabase"],
    userId: string
): Promise<boolean> {
    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

    return profile?.role === "admin" || profile?.role === "site_admin";
}

/**
 * Get user from context (type guard)
 */
export function requireUser(ctx: BaseContext): ctx is AuthContext {
    return "user" in ctx && ctx.user !== null;
}
