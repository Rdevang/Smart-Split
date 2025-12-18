/**
 * CSRF Protection Utility
 * 
 * Implements a double-submit cookie pattern for CSRF protection on server actions.
 * 
 * How it works:
 * 1. A cryptographically secure token is generated and stored in an httpOnly cookie
 * 2. The same token is embedded in forms via a hidden input
 * 3. On form submission, both tokens are compared
 * 4. Request is rejected if tokens don't match
 * 
 * This protects against CSRF because attackers:
 * - Cannot read the httpOnly cookie value
 * - Cannot modify the httpOnly cookie due to same-site policy
 */

import { cookies } from "next/headers";
import { randomBytes, timingSafeEqual } from "crypto";

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
 */
export async function createCsrfToken(): Promise<string> {
    const token = generateToken();
    const cookieStore = await cookies();
    
    // Set httpOnly, secure, sameSite cookie
    // Using __Host- prefix ensures the cookie:
    // - Is only sent over HTTPS
    // - Cannot have a Domain attribute
    // - Must have Path=/
    cookieStore.set(CSRF_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: CSRF_TOKEN_EXPIRY,
    });
    
    return token;
}

/**
 * Validates a CSRF token from form data against the cookie
 * Uses timing-safe comparison to prevent timing attacks
 */
export async function validateCsrfToken(formToken: string | null): Promise<CsrfValidationResult> {
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
    
    const isValid = timingSafeEqual(cookieBuffer, formBuffer);
    
    if (!isValid) {
        return { valid: false, error: "Invalid CSRF token. Please refresh the page." };
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
 */
export async function getCsrfToken(): Promise<string> {
    const cookieStore = await cookies();
    const existingToken = cookieStore.get(CSRF_COOKIE_NAME)?.value;
    
    if (existingToken) {
        return existingToken;
    }
    
    return createCsrfToken();
}

