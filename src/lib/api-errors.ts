/**
 * Safe API Error Handling
 * 
 * SECURITY: This module provides utilities to safely handle and return errors
 * in API responses without leaking sensitive information like stack traces,
 * internal error messages, or system details.
 */

import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

// ============================================
// ERROR TYPES
// ============================================

/**
 * Standard API error codes that can be safely exposed to clients
 */
export const ApiErrorCodes = {
    // Generic errors
    INTERNAL_ERROR: "INTERNAL_ERROR",
    BAD_REQUEST: "BAD_REQUEST",
    UNAUTHORIZED: "UNAUTHORIZED",
    FORBIDDEN: "FORBIDDEN",
    NOT_FOUND: "NOT_FOUND",
    CONFLICT: "CONFLICT",
    RATE_LIMITED: "RATE_LIMITED",
    VALIDATION_ERROR: "VALIDATION_ERROR",
    
    // Auth errors
    INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
    SESSION_EXPIRED: "SESSION_EXPIRED",
    ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
    
    // Resource errors
    RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
    RESOURCE_ALREADY_EXISTS: "RESOURCE_ALREADY_EXISTS",
    ACCESS_DENIED: "ACCESS_DENIED",
    
    // Operation errors
    OPERATION_FAILED: "OPERATION_FAILED",
    OPERATION_IN_PROGRESS: "OPERATION_IN_PROGRESS",
    SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
} as const;

export type ApiErrorCode = typeof ApiErrorCodes[keyof typeof ApiErrorCodes];

/**
 * Generic error messages that don't leak implementation details
 */
const GENERIC_ERROR_MESSAGES: Record<ApiErrorCode, string> = {
    [ApiErrorCodes.INTERNAL_ERROR]: "An internal error occurred. Please try again later.",
    [ApiErrorCodes.BAD_REQUEST]: "The request was invalid.",
    [ApiErrorCodes.UNAUTHORIZED]: "Authentication required.",
    [ApiErrorCodes.FORBIDDEN]: "You don't have permission to perform this action.",
    [ApiErrorCodes.NOT_FOUND]: "The requested resource was not found.",
    [ApiErrorCodes.CONFLICT]: "The operation could not be completed due to a conflict.",
    [ApiErrorCodes.RATE_LIMITED]: "Too many requests. Please try again later.",
    [ApiErrorCodes.VALIDATION_ERROR]: "The provided data is invalid.",
    [ApiErrorCodes.INVALID_CREDENTIALS]: "Invalid credentials.",
    [ApiErrorCodes.SESSION_EXPIRED]: "Your session has expired. Please log in again.",
    [ApiErrorCodes.ACCOUNT_LOCKED]: "Account temporarily locked. Please try again later.",
    [ApiErrorCodes.RESOURCE_NOT_FOUND]: "Resource not found.",
    [ApiErrorCodes.RESOURCE_ALREADY_EXISTS]: "Resource already exists.",
    [ApiErrorCodes.ACCESS_DENIED]: "Access denied.",
    [ApiErrorCodes.OPERATION_FAILED]: "The operation could not be completed.",
    [ApiErrorCodes.OPERATION_IN_PROGRESS]: "Operation is already in progress. Please wait.",
    [ApiErrorCodes.SERVICE_UNAVAILABLE]: "Service temporarily unavailable.",
};

// ============================================
// RESPONSE HELPERS
// ============================================

interface ApiErrorOptions {
    /** The error code */
    code: ApiErrorCode;
    /** Custom message (optional - uses generic message if not provided) */
    message?: string;
    /** HTTP status code */
    status: number;
    /** Additional headers */
    headers?: Record<string, string>;
    /** Internal error for logging (never exposed to client) */
    internalError?: Error | unknown;
    /** Additional context for logging */
    logContext?: Record<string, unknown>;
}

/**
 * Create a safe error response that doesn't leak sensitive information
 * 
 * SECURITY: This function ensures:
 * 1. Stack traces are never exposed
 * 2. Internal error messages are logged but not returned
 * 3. Only generic, safe messages are sent to clients
 */
export function createErrorResponse(options: ApiErrorOptions): NextResponse {
    const { code, message, status, headers = {}, internalError, logContext } = options;
    
    // Get the safe message to return
    const safeMessage = message || GENERIC_ERROR_MESSAGES[code] || "An error occurred.";
    
    // Log the full error internally (with stack trace) for debugging
    if (internalError) {
        const errorObj = internalError instanceof Error 
            ? internalError 
            : new Error(String(internalError));
        
        logger.error(`API Error [${code}]: ${safeMessage}`, errorObj, {
            errorCode: code,
            status,
            ...logContext,
        });
    }
    
    // Return safe response without stack traces
    return NextResponse.json(
        {
            error: code,
            message: safeMessage,
            // Only include timestamp in development for debugging
            ...(process.env.NODE_ENV === "development" && {
                timestamp: new Date().toISOString(),
            }),
        },
        {
            status,
            headers: {
                "Content-Type": "application/json",
                ...headers,
            },
        }
    );
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * 400 Bad Request
 */
export function badRequest(message?: string, internalError?: Error | unknown) {
    return createErrorResponse({
        code: ApiErrorCodes.BAD_REQUEST,
        message,
        status: 400,
        internalError,
    });
}

/**
 * 401 Unauthorized
 */
export function unauthorized(message?: string, internalError?: Error | unknown) {
    return createErrorResponse({
        code: ApiErrorCodes.UNAUTHORIZED,
        message,
        status: 401,
        internalError,
    });
}

/**
 * 403 Forbidden
 */
export function forbidden(message?: string, internalError?: Error | unknown) {
    return createErrorResponse({
        code: ApiErrorCodes.FORBIDDEN,
        message,
        status: 403,
        internalError,
    });
}

/**
 * 404 Not Found
 */
export function notFound(message?: string, internalError?: Error | unknown) {
    return createErrorResponse({
        code: ApiErrorCodes.NOT_FOUND,
        message,
        status: 404,
        internalError,
    });
}

/**
 * 409 Conflict
 */
export function conflict(message?: string, internalError?: Error | unknown) {
    return createErrorResponse({
        code: ApiErrorCodes.CONFLICT,
        message,
        status: 409,
        internalError,
    });
}

/**
 * 429 Rate Limited
 */
export function rateLimited(retryAfter?: number, internalError?: Error | unknown) {
    return createErrorResponse({
        code: ApiErrorCodes.RATE_LIMITED,
        status: 429,
        headers: retryAfter ? { "Retry-After": String(retryAfter) } : {},
        internalError,
    });
}

/**
 * 500 Internal Server Error
 * 
 * SECURITY: This is the most important one - NEVER expose internal details
 */
export function internalError(internalError?: Error | unknown, logContext?: Record<string, unknown>) {
    return createErrorResponse({
        code: ApiErrorCodes.INTERNAL_ERROR,
        status: 500,
        internalError,
        logContext,
    });
}

/**
 * 503 Service Unavailable
 */
export function serviceUnavailable(retryAfter?: number, internalError?: Error | unknown) {
    return createErrorResponse({
        code: ApiErrorCodes.SERVICE_UNAVAILABLE,
        status: 503,
        headers: retryAfter ? { "Retry-After": String(retryAfter) } : {},
        internalError,
    });
}

// ============================================
// ERROR WRAPPING
// ============================================

/**
 * Wrap an async handler to catch errors and return safe responses
 * 
 * Usage:
 * ```typescript
 * export const GET = withSafeErrors(async (request) => {
 *     // Your code here - any thrown errors will be caught
 *     // and converted to safe responses
 * });
 * ```
 */
export function withSafeErrors<T extends (...args: Parameters<T>) => Promise<NextResponse>>(
    handler: T
): (...args: Parameters<T>) => Promise<NextResponse> {
    return async (...args: Parameters<T>): Promise<NextResponse> => {
        try {
            return await handler(...args);
        } catch (error) {
            // Log the full error for debugging
            logger.error("Unhandled API error", error instanceof Error ? error : new Error(String(error)));
            
            // Return safe generic error
            return internalError(error);
        }
    };
}

/**
 * Safely extract error message without leaking sensitive info
 * Only returns the message if it's a known safe error type
 */
export function getSafeErrorMessage(error: unknown): string {
    // In production, never expose raw error messages
    if (process.env.NODE_ENV === "production") {
        return GENERIC_ERROR_MESSAGES[ApiErrorCodes.INTERNAL_ERROR];
    }
    
    // In development, we can be more helpful
    if (error instanceof Error) {
        return error.message;
    }
    
    return String(error);
}

