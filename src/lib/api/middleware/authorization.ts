/**
 * Authorization Middleware
 * 
 * Provides authorization middleware for group-based access control.
 * These middleware require authentication (use after withAuth).
 * 
 * USAGE:
 *   // Verify user is group member
 *   createRoute()
 *       .use(withAuth())
 *       .use(withGroupMembership("groupId"))
 *       .handler(...)
 *   
 *   // Verify user is group admin
 *   createRoute()
 *       .use(withAuth())
 *       .use(withGroupAdmin("groupId"))
 *       .handler(...)
 */

import type { Middleware, AuthContext } from "../route-builder";
import { ApiError } from "@/lib/api-responses";

// ============================================
// TYPES
// ============================================

/**
 * Context with verified group membership
 */
export interface GroupMemberContext extends AuthContext {
    groupId: string;
    membership: {
        id: string;
        role: "admin" | "member";
    };
}

/**
 * Context with verified group admin status
 */
export interface GroupAdminContext extends GroupMemberContext {
    membership: {
        id: string;
        role: "admin";
    };
}

/**
 * Options for group membership middleware
 */
export interface GroupMembershipOptions {
    /** Allow request body groupId if param not found */
    allowBodyGroupId?: boolean;
    /** Allow query param groupId if param not found */
    allowQueryGroupId?: boolean;
}

// ============================================
// MIDDLEWARE
// ============================================

/**
 * Verify user is a member of the specified group
 * 
 * Adds `groupId` and `membership` to context.
 * Returns 400 if groupId missing, 403 if not a member.
 * 
 * USAGE:
 *   // From route param (e.g., /api/groups/[groupId])
 *   createRoute()
 *       .use(withAuth())
 *       .use(withGroupMembership("groupId"))
 *       .handler(async (ctx) => {
 *           // ctx.groupId and ctx.membership available
 *       });
 *   
 *   // From request body or query
 *   createRoute()
 *       .use(withAuth())
 *       .use(withGroupMembership("groupId", { allowBodyGroupId: true }))
 *       .handler(...)
 */
export function withGroupMembership(
    paramName: string,
    options: GroupMembershipOptions = {}
): Middleware<AuthContext, GroupMemberContext> {
    return async (ctx) => {
        // Try to get groupId from various sources
        let groupId = ctx.params[paramName];

        // Try body if allowed and param not found
        if (!groupId && options.allowBodyGroupId) {
            try {
                const body = await ctx.request.clone().json();
                groupId = body[paramName] || body.group_id;
            } catch {
                // Body not JSON or missing field
            }
        }

        // Try query if allowed and param not found
        if (!groupId && options.allowQueryGroupId) {
            const queryValue = ctx.request.nextUrl.searchParams.get(paramName) ||
                ctx.request.nextUrl.searchParams.get("group_id");
            if (queryValue) {
                groupId = queryValue;
            }
        }

        if (!groupId) {
            return ApiError.badRequest(`Missing ${paramName} parameter`);
        }

        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(groupId)) {
            return ApiError.badRequest("Invalid group ID format");
        }

        // Check membership
        const { data: membership, error } = await ctx.supabase
            .from("group_members")
            .select("id, role")
            .eq("group_id", groupId)
            .eq("user_id", ctx.user.id)
            .single();

        if (error || !membership) {
            return ApiError.forbidden("You are not a member of this group");
        }

        return {
            ...ctx,
            groupId,
            membership: {
                id: membership.id,
                role: membership.role as "admin" | "member",
            },
        };
    };
}

/**
 * Verify user is an admin of the specified group
 * 
 * Adds `groupId` and `membership` (with role: "admin") to context.
 * Returns 400 if groupId missing, 403 if not an admin.
 * 
 * USAGE:
 *   createRoute()
 *       .use(withAuth())
 *       .use(withGroupAdmin("groupId"))
 *       .handler(async (ctx) => {
 *           // ctx.membership.role is "admin"
 *       });
 */
export function withGroupAdmin(
    paramName: string,
    options: GroupMembershipOptions = {}
): Middleware<AuthContext, GroupAdminContext> {
    return async (ctx) => {
        // First check membership
        const membershipMiddleware = withGroupMembership(paramName, options);
        const result = await membershipMiddleware(ctx);

        // If membership check returned a response (error), pass it through
        if (result instanceof Response) {
            return result as ReturnType<typeof ApiError.forbidden>;
        }

        // Check if user is admin
        if (result.membership.role !== "admin") {
            return ApiError.forbidden("Admin access required for this group");
        }

        return result as GroupAdminContext;
    };
}

/**
 * Verify group exists (without requiring membership)
 * 
 * Useful for public group info endpoints.
 * Returns 404 if group doesn't exist.
 * 
 * USAGE:
 *   createRoute()
 *       .use(withGroupExists("groupId"))
 *       .handler(...)
 */
export function withGroupExists(
    paramName: string
): Middleware<AuthContext, AuthContext & { groupId: string; groupExists: true }> {
    return async (ctx) => {
        const groupId = ctx.params[paramName];

        if (!groupId) {
            return ApiError.badRequest(`Missing ${paramName} parameter`);
        }

        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(groupId)) {
            return ApiError.badRequest("Invalid group ID format");
        }

        // Check if group exists
        const { data: group, error } = await ctx.supabase
            .from("groups")
            .select("id")
            .eq("id", groupId)
            .single();

        if (error || !group) {
            return ApiError.notFound("Group");
        }

        return {
            ...ctx,
            groupId,
            groupExists: true as const,
        };
    };
}

/**
 * Verify user can access a specific expense
 * 
 * User must be a member of the expense's group.
 * 
 * USAGE:
 *   createRoute()
 *       .use(withAuth())
 *       .use(withExpenseAccess("expenseId"))
 *       .handler(...)
 */
export function withExpenseAccess(
    paramName: string
): Middleware<AuthContext, AuthContext & { expenseId: string; groupId: string }> {
    return async (ctx) => {
        const expenseId = ctx.params[paramName];

        if (!expenseId) {
            return ApiError.badRequest(`Missing ${paramName} parameter`);
        }

        // Get expense and its group
        const { data: expense, error } = await ctx.supabase
            .from("expenses")
            .select("id, group_id")
            .eq("id", expenseId)
            .single();

        if (error || !expense) {
            return ApiError.notFound("Expense");
        }

        // Check user is member of the expense's group
        const { data: membership } = await ctx.supabase
            .from("group_members")
            .select("id")
            .eq("group_id", expense.group_id)
            .eq("user_id", ctx.user.id)
            .single();

        if (!membership) {
            return ApiError.forbidden("You don't have access to this expense");
        }

        return {
            ...ctx,
            expenseId,
            groupId: expense.group_id,
        };
    };
}
