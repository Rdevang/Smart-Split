/**
 * API Route Builder - Barrel Export
 * 
 * Central export for all route builder utilities and middleware.
 * Import everything from this single module for clean code.
 * 
 * USAGE:
 *   import { 
 *       createRoute, 
 *       withAuth, 
 *       withValidation, 
 *       withRateLimit,
 *       ApiResponse,
 *       ApiError 
 *   } from "@/lib/api";
 *   
 *   export const GET = createRoute()
 *       .use(withAuth())
 *       .use(withRateLimit("api"))
 *       .handler(async (ctx) => {
 *           return ApiResponse.success({ user: ctx.user.email });
 *       });
 */

// ============================================
// ROUTE BUILDER
// ============================================
export {
    createRoute,
    isResponse,
    passthrough,
    compose,
    type BaseContext,
    type AuthContext,
    type OptionalAuthContext,
    type ValidatedContext,
    type QueryValidatedContext,
    type Middleware,
    type Handler,
    type RouteParams,
} from "./route-builder";

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================
export {
    withAuth,
    withOptionalAuth,
    withAdminAuth,
    withSelfOrAdmin,
    isUserAdmin,
    requireUser,
    type AdminAuthContext,
} from "./middleware/auth";

// ============================================
// AUTHORIZATION MIDDLEWARE
// ============================================
export {
    withGroupMembership,
    withGroupAdmin,
    withGroupExists,
    withExpenseAccess,
    type GroupMemberContext,
    type GroupAdminContext,
    type GroupMembershipOptions,
} from "./middleware/authorization";

// ============================================
// VALIDATION MIDDLEWARE
// ============================================
export {
    withValidation,
    withValidationCustom,
    withQueryValidation,
    withBodyAndQuery,
    PaginationSchema,
    UuidParamSchema,
    DateRangeSchema,
    type ValidationOptions,
    type QueryValidationOptions,
} from "./middleware/validation";

// ============================================
// RATE LIMITING MIDDLEWARE
// ============================================
export {
    withRateLimit,
    withRateLimitByUser,
    withRateLimitCombined,
    withCronAuth,
    type RateLimitType,
    type RateLimitContext,
    type RateLimitOptions,
} from "./middleware/rate-limit";

// ============================================
// API RESPONSES (re-export from existing)
// ============================================
export {
    ApiResponse,
    ApiError,
    withErrorHandler,
    type ApiSuccessResponse,
    type ApiErrorResponse,
} from "../api-responses";
