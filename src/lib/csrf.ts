/**
 * CSRF Protection Utility
 * 
 * Implements a stateless signed token pattern for CSRF protection.
 * 
 * How it works:
 * 1. Generate a token containing: timestamp + random nonce
 * 2. Sign the token with HMAC-SHA256 using a secret key
 * 3. Token is embedded in forms via hidden input
 * 4. On submission, verify the signature and check token isn't expired
 * 
 * This approach works with Next.js 16 because:
 * - No cookies need to be set from Server Components
 * - Tokens are self-contained and stateless
 * - Validation happens in Server Actions (which can read the token)
 */

import { createHmac, randomBytes, timingSafeEqual } from "crypto";

// Token configuration
const TOKEN_EXPIRY_SECONDS = 60 * 60; // 1 hour
const TOKEN_VERSION = "v1"; // For future migrations

// Get secret key - falls back to a development key if not set
// In production, CSRF_SECRET should be set to a random 32+ character string
function getSecretKey(): string {
    const secret = process.env.CSRF_SECRET;
    if (!secret) {
        // Development fallback - NOT SECURE FOR PRODUCTION
        if (process.env.NODE_ENV === "production") {
            console.warn("CSRF_SECRET not set in production! Using fallback key.");
        }
        return "development-csrf-secret-key-not-for-production";
    }
    return secret;
}

export interface CsrfValidationResult {
    valid: boolean;
    error?: string;
}

/**
 * Creates an HMAC signature for the given data
 */
function createSignature(data: string): string {
    const hmac = createHmac("sha256", getSecretKey());
    hmac.update(data);
    return hmac.digest("hex");
}

/**
 * Generates a CSRF token
 * Format: version.timestamp.nonce.signature
 * 
 * @returns A signed CSRF token string
 */
export async function createCsrfToken(): Promise<string> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = randomBytes(16).toString("hex");

    // Data to sign: version + timestamp + nonce
    const data = `${TOKEN_VERSION}.${timestamp}.${nonce}`;
    const signature = createSignature(data);

    // Return complete token
    return `${data}.${signature}`;
}

/**
 * Validates a CSRF token
 * Checks:
 * 1. Token format is valid
 * 2. Signature is valid (token wasn't tampered with)
 * 3. Token hasn't expired
 * 
 * @param token - The token from form submission
 * @returns Validation result with error message if invalid
 */
export async function validateCsrfToken(token: string | null): Promise<CsrfValidationResult> {
    if (!token) {
        return { valid: false, error: "CSRF token not provided. Please refresh the page." };
    }

    // Parse token: version.timestamp.nonce.signature
    const parts = token.split(".");
    if (parts.length !== 4) {
        return { valid: false, error: "Invalid CSRF token format. Please refresh the page." };
    }

    const [version, timestamp, nonce, providedSignature] = parts;

    // Check version
    if (version !== TOKEN_VERSION) {
        return { valid: false, error: "Invalid CSRF token version. Please refresh the page." };
    }

    // Verify signature
    const data = `${version}.${timestamp}.${nonce}`;
    const expectedSignature = createSignature(data);

    // Use timing-safe comparison to prevent timing attacks
    const providedBuffer = Buffer.from(providedSignature, "utf-8");
    const expectedBuffer = Buffer.from(expectedSignature, "utf-8");

    if (providedBuffer.length !== expectedBuffer.length) {
        return { valid: false, error: "Invalid CSRF token. Please refresh the page." };
    }

    if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
        return { valid: false, error: "Invalid CSRF token. Please refresh the page." };
    }

    // Check expiration
    const tokenTime = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);

    if (isNaN(tokenTime) || now - tokenTime > TOKEN_EXPIRY_SECONDS) {
        return { valid: false, error: "CSRF token has expired. Please refresh the page." };
    }

    // Check for future tokens (clock skew protection - allow 60 seconds)
    if (tokenTime > now + 60) {
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
 * Gets or creates a CSRF token
 * Alias for createCsrfToken for backward compatibility
 */
export async function getCsrfToken(): Promise<string> {
    return createCsrfToken();
}
