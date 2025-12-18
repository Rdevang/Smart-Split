/**
 * Generic Auth Error Messages
 * 
 * This module provides consistent, generic error messages for authentication
 * to prevent user enumeration attacks.
 * 
 * User enumeration occurs when different error messages reveal whether:
 * - An email is registered
 * - A phone number is registered
 * - An account exists
 * 
 * SECURITY PRINCIPLE: Error messages should NOT reveal account existence.
 */

import { logger, SecurityEvents } from "@/lib/logger";

// Error codes from Supabase that indicate specific conditions
const USER_EXISTS_ERRORS = [
    "User already registered",
    "user already exists",
    "duplicate key value",
    "email_exists",
    "phone_exists",
];

const INVALID_CREDENTIALS_ERRORS = [
    "Invalid login credentials",
    "invalid_credentials", 
    "Invalid password",
    "Invalid email",
    "User not found",
    "Email not confirmed",
];

const RATE_LIMIT_ERRORS = [
    "too many requests",
    "rate limit",
    "too_many_requests",
];

const EXPIRED_ERRORS = [
    "otp_expired",
    "token expired",
    "link expired",
    "session expired",
];

export type AuthErrorType = 
    | "login" 
    | "register" 
    | "password_reset" 
    | "otp" 
    | "oauth"
    | "generic";

interface GenericErrorOptions {
    /** Original error message (for logging purposes only) */
    originalError: string;
    /** Type of auth operation */
    type: AuthErrorType;
    /** Additional context for logging (will be redacted) */
    context?: Record<string, unknown>;
}

/**
 * Returns a generic, safe error message that doesn't reveal account existence
 * 
 * @param options - Error options including original error and type
 * @returns Generic error message safe to show to users
 */
export function getGenericAuthError(options: GenericErrorOptions): string {
    const { originalError, type, context } = options;
    const lowerError = originalError.toLowerCase();
    
    // Log the actual error internally for debugging
    logger.warn("Auth error occurred (showing generic message to user)", {
        originalError,
        errorType: type,
        context,
    });
    
    // Check for rate limiting (always reveal this - it's expected behavior)
    if (RATE_LIMIT_ERRORS.some(e => lowerError.includes(e.toLowerCase()))) {
        return "Too many attempts. Please try again later.";
    }
    
    // Check for expired tokens/OTPs (safe to reveal)
    if (EXPIRED_ERRORS.some(e => lowerError.includes(e.toLowerCase()))) {
        return "This link or code has expired. Please request a new one.";
    }
    
    // Return generic messages based on operation type
    switch (type) {
        case "login":
            // Don't reveal if email exists or password is wrong
            return "Invalid email or password. Please check your credentials and try again.";
            
        case "register":
            // Don't reveal if email already exists
            // Check if it's specifically a user exists error to log it
            if (USER_EXISTS_ERRORS.some(e => lowerError.includes(e.toLowerCase()))) {
                logger.security(
                    SecurityEvents.ACCOUNT_CREATION_ATTEMPT,
                    "low",
                    "blocked",
                    { reason: "email_exists", ...context }
                );
            }
            return "Unable to create account. Please try again or use a different email address.";
            
        case "password_reset":
            // Always show success-like message to prevent email enumeration
            return "If an account exists with this email, you will receive a password reset link.";
            
        case "otp":
            // Don't reveal if phone number is registered
            return "Unable to verify code. Please check the code and try again.";
            
        case "oauth":
            // Generic OAuth error
            return "Authentication failed. Please try again or use a different sign-in method.";
            
        case "generic":
        default:
            return "An error occurred. Please try again.";
    }
}

/**
 * Maps Supabase error codes to generic messages
 * Use this when you have the error code (not just message)
 */
export function getErrorByCode(code: string): string {
    const errorCodeMap: Record<string, string> = {
        // Auth errors
        "invalid_credentials": "Invalid email or password.",
        "email_not_confirmed": "Please verify your email before signing in.",
        "user_banned": "Account access restricted. Please contact support.",
        "email_exists": "Unable to create account with this email.",
        "phone_exists": "Unable to create account with this phone number.",
        "otp_expired": "Verification code has expired. Please request a new one.",
        "invalid_otp": "Invalid verification code. Please try again.",
        
        // Rate limiting
        "over_request_rate_limit": "Too many requests. Please wait a moment.",
        "over_email_send_rate_limit": "Too many emails sent. Please wait before trying again.",
        "over_sms_send_rate_limit": "Too many SMS sent. Please wait before trying again.",
        
        // Session errors
        "session_not_found": "Session expired. Please sign in again.",
        "refresh_token_not_found": "Session expired. Please sign in again.",
    };
    
    return errorCodeMap[code] || "An error occurred. Please try again.";
}

/**
 * Checks if the error indicates the user should retry
 */
export function isRetryableError(error: string): boolean {
    const lowerError = error.toLowerCase();
    const retryablePatterns = [
        "network",
        "timeout",
        "temporarily unavailable",
        "try again",
        "connection",
    ];
    
    return retryablePatterns.some(pattern => lowerError.includes(pattern));
}

