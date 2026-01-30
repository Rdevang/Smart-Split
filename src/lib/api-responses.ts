/**
 * Centralized API Response Helpers
 * 
 * This module provides consistent response formatting for all API routes.
 * Use these helpers instead of manually creating NextResponse objects.
 * 
 * USAGE:
 *   import { ApiResponse, ApiError } from "@/lib/api-responses";
 *   
 *   // Success
 *   return ApiResponse.success(data);
 *   return ApiResponse.created(data);
 *   
 *   // Errors
 *   return ApiError.unauthorized();
 *   return ApiError.notFound("Group");
 *   return ApiError.badRequest("Invalid input");
 */

import { NextResponse } from "next/server";

// ============================================
// TYPES
// ============================================

export interface ApiSuccessResponse<T> {
    data: T;
    success: true;
}

export interface ApiErrorResponse {
    error: string;
    code?: string;
    details?: Record<string, unknown>;
}

// ============================================
// SUCCESS RESPONSES
// ============================================

export const ApiResponse = {
    /**
     * 200 OK - Standard success response
     */
    success<T>(data: T, headers?: HeadersInit): NextResponse {
        return NextResponse.json(data, { status: 200, headers });
    },

    /**
     * 201 Created - Resource created successfully
     */
    created<T>(data: T): NextResponse {
        return NextResponse.json(data, { status: 201 });
    },

    /**
     * 204 No Content - Success with no response body
     */
    noContent(): NextResponse {
        return new NextResponse(null, { status: 204 });
    },

    /**
     * Success with pagination metadata
     */
    paginated<T>(
        data: T[],
        pagination: {
            page: number;
            limit: number;
            totalCount: number;
            hasMore: boolean;
        }
    ): NextResponse {
        return NextResponse.json({
            data,
            ...pagination,
        });
    },
};

// ============================================
// ERROR RESPONSES
// ============================================

export const ApiError = {
    /**
     * 400 Bad Request - Invalid input or malformed request
     */
    badRequest(message = "Bad request", details?: Record<string, unknown>): NextResponse<ApiErrorResponse> {
        return NextResponse.json(
            { error: message, code: "BAD_REQUEST", details },
            { status: 400 }
        );
    },

    /**
     * 401 Unauthorized - No valid authentication
     */
    unauthorized(message = "Unauthorized"): NextResponse<ApiErrorResponse> {
        return NextResponse.json(
            { error: message, code: "UNAUTHORIZED" },
            { status: 401 }
        );
    },

    /**
     * 403 Forbidden - Authenticated but not authorized
     */
    forbidden(message = "Access denied"): NextResponse<ApiErrorResponse> {
        return NextResponse.json(
            { error: message, code: "FORBIDDEN" },
            { status: 403 }
        );
    },

    /**
     * 404 Not Found - Resource doesn't exist
     */
    notFound(resource = "Resource"): NextResponse<ApiErrorResponse> {
        return NextResponse.json(
            { error: `${resource} not found`, code: "NOT_FOUND" },
            { status: 404 }
        );
    },

    /**
     * 405 Method Not Allowed
     */
    methodNotAllowed(allowed: string[]): NextResponse<ApiErrorResponse> {
        return NextResponse.json(
            { error: "Method not allowed", code: "METHOD_NOT_ALLOWED" },
            {
                status: 405,
                headers: { Allow: allowed.join(", ") },
            }
        );
    },

    /**
     * 409 Conflict - Resource state conflict
     */
    conflict(message = "Resource conflict"): NextResponse<ApiErrorResponse> {
        return NextResponse.json(
            { error: message, code: "CONFLICT" },
            { status: 409 }
        );
    },

    /**
     * 422 Unprocessable Entity - Validation failed
     */
    validation(errors: Record<string, string[]>): NextResponse<ApiErrorResponse> {
        return NextResponse.json(
            { error: "Validation failed", code: "VALIDATION_ERROR", details: errors },
            { status: 422 }
        );
    },

    /**
     * 429 Too Many Requests - Rate limited
     */
    rateLimited(retryAfter?: number): NextResponse<ApiErrorResponse> {
        const headers: HeadersInit = {};
        if (retryAfter) {
            headers["Retry-After"] = retryAfter.toString();
        }
        return NextResponse.json(
            { error: "Too many requests", code: "RATE_LIMITED" },
            { status: 429, headers }
        );
    },

    /**
     * 500 Internal Server Error - Unexpected error
     */
    internal(message = "Internal server error"): NextResponse<ApiErrorResponse> {
        return NextResponse.json(
            { error: message, code: "INTERNAL_ERROR" },
            { status: 500 }
        );
    },

    /**
     * 503 Service Unavailable - Temporary unavailability
     */
    unavailable(message = "Service temporarily unavailable"): NextResponse<ApiErrorResponse> {
        return NextResponse.json(
            { error: message, code: "SERVICE_UNAVAILABLE" },
            { status: 503 }
        );
    },

    /**
     * Custom error with any status code
     */
    custom(status: number, message: string, code?: string): NextResponse<ApiErrorResponse> {
        return NextResponse.json(
            { error: message, code: code || "ERROR" },
            { status }
        );
    },
};

// ============================================
// HELPER TO HANDLE TRY/CATCH
// ============================================

/**
 * Wraps an async handler with standard error handling
 * 
 * USAGE:
 *   export const GET = withErrorHandler(async (request) => {
 *       // Your logic here
 *       return ApiResponse.success(data);
 *   });
 */
export function withErrorHandler<T extends unknown[]>(
    handler: (...args: T) => Promise<NextResponse>
): (...args: T) => Promise<NextResponse> {
    return async (...args: T): Promise<NextResponse> => {
        try {
            return await handler(...args);
        } catch (error) {
            console.error("API Error:", error);
            return ApiError.internal();
        }
    };
}
