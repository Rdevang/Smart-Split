/**
 * CSRF Protection Utility
 * 
 * NOTE: CSRF protection is currently DISABLED due to Next.js 16 restrictions.
 * Server Components cannot set cookies, which breaks the double-submit pattern.
 * 
 * TODO: Re-implement using a different approach:
 * - Route Handler for token generation
 * - Or client-side token with server validation
 * 
 * Original implementation used a double-submit cookie pattern.
 */

import { cookies } from "next/headers";
import { randomBytes } from "crypto";

// CSRF is temporarily disabled - always returns valid
const CSRF_DISABLED = true;

const CSRF_COOKIE_NAME = "__Host-csrf-token";
const CSRF_TOKEN_LENGTH = 32; // 256 bits
const CSRF_TOKEN_EXPIRY = 60 * 60; // 1 hour in seconds

export interface CsrfValidationResult {
    valid: boolean;
    error?: string;
}

/**
 * Generates a cryptographically secure CSRF token
 */
function generateToken(): string {
    return randomBytes(CSRF_TOKEN_LENGTH).toString("hex");
}

/**
 * Creates a new CSRF token and sets it as an httpOnly cookie
 * Returns the token value to be embedded in forms
 * 
 * NOTE: Currently returns a dummy token due to Next.js 16 restrictions
 */
export async function createCsrfToken(): Promise<string> {
    if (CSRF_DISABLED) {
        return "csrf-disabled";
    }

    const token = generateToken();

    try {
        const cookieStore = await cookies();
        cookieStore.set(CSRF_COOKIE_NAME, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/",
            maxAge: CSRF_TOKEN_EXPIRY,
        });
    } catch {
        // Cookie setting not allowed in this context
    }

    return token;
}

/**
 * Validates a CSRF token from form data against the cookie
 * Uses timing-safe comparison to prevent timing attacks
 * 
 * NOTE: Currently always returns valid due to Next.js 16 restrictions
 */
export async function validateCsrfToken(formToken: string | null): Promise<CsrfValidationResult> {
    if (CSRF_DISABLED) {
        return { valid: true };
    }

    // Get the token from the cookie
    const cookieStore = await cookies();
    const cookieToken = cookieStore.get(CSRF_COOKIE_NAME)?.value;

    // Both tokens must exist
    if (!cookieToken) {
        return { valid: false, error: "CSRF cookie not found. Please refresh the page." };
    }

    if (!formToken) {
        return { valid: false, error: "CSRF token not provided. Please refresh the page." };
    }

    // Tokens must be the same length
    if (cookieToken.length !== formToken.length) {
        return { valid: false, error: "Invalid CSRF token. Please refresh the page." };
    }

    // Use timing-safe comparison to prevent timing attacks
    const cookieBuffer = Buffer.from(cookieToken, "utf-8");
    const formBuffer = Buffer.from(formToken, "utf-8");

    try {
        const { timingSafeEqual } = await import("crypto");
        const isValid = timingSafeEqual(cookieBuffer, formBuffer);

        if (!isValid) {
            return { valid: false, error: "Invalid CSRF token. Please refresh the page." };
        }
    } catch {
        return { valid: false, error: "CSRF validation failed." };
    }

    return { valid: true };
}

/**
 * Higher-order function to wrap server actions with CSRF protection
 * 
 * @example
 * ```ts
 * export const login = withCsrfProtection(async (formData: FormData) => {
 *     // Your login logic here
 * });
 * ```
 */
export function withCsrfProtection<T extends FormData, R>(
    action: (formData: T) => Promise<R>
): (formData: T) => Promise<R | { error: string }> {
    return async (formData: T): Promise<R | { error: string }> => {
        const csrfToken = formData.get("csrf_token") as string | null;

        const validation = await validateCsrfToken(csrfToken);
        if (!validation.valid) {
            return { error: validation.error || "CSRF validation failed" };
        }

        return action(formData);
    };
}

/**
 * Gets the current CSRF token from cookie or creates a new one
 * Use this in page components to get the token for forms
 * 
 * NOTE: Currently returns a dummy token due to Next.js 16 restrictions
 */
export async function getCsrfToken(): Promise<string> {
    if (CSRF_DISABLED) {
        return "csrf-disabled";
    }

    try {
        const cookieStore = await cookies();
        const existingToken = cookieStore.get(CSRF_COOKIE_NAME)?.value;

        if (existingToken) {
            return existingToken;
        }
    } catch {
        // Cookie access failed
    }

    return createCsrfToken();
}

