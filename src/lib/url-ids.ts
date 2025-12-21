/**
 * URL-safe ID encryption/decryption
 * Hides real database UUIDs in URLs to prevent enumeration attacks
 * 
 * Uses AES encryption with URL-safe base64 encoding
 */

import { createCipheriv, createDecipheriv, scryptSync } from "crypto";

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;
const KEY_LENGTH = 32;

// Prefix to identify encoded IDs (helps with debugging and versioning)
const URL_ID_PREFIX = "s_"; // "s" for Smart Split

/**
 * Get encryption key for URL IDs
 * Uses a separate derivation from the main encryption key
 */
function getUrlIdKey(): Buffer {
    const secret = process.env.ENCRYPTION_KEY || process.env.CSRF_SECRET;
    
    if (!secret) {
        throw new Error("ENCRYPTION_KEY or CSRF_SECRET required for URL ID encryption");
    }
    
    // Use different salt than main encryption for key separation
    const salt = Buffer.from("smart-split-url-ids-v1", "utf-8");
    return scryptSync(secret, salt, KEY_LENGTH);
}

/**
 * Convert standard base64 to URL-safe base64
 */
function toUrlSafeBase64(base64: string): string {
    return base64
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
}

/**
 * Convert URL-safe base64 back to standard base64
 */
function fromUrlSafeBase64(urlSafe: string): string {
    let base64 = urlSafe
        .replace(/-/g, "+")
        .replace(/_/g, "/");
    
    // Add padding back
    const padding = (4 - (base64.length % 4)) % 4;
    base64 += "=".repeat(padding);
    
    return base64;
}

/**
 * Encrypt a UUID for use in URLs
 * Returns a URL-safe encrypted string
 * 
 * @example
 * const urlId = encryptUrlId("123e4567-e89b-12d3-a456-426614174000");
 * // Returns: "s_abc123xyz..."
 */
export function encryptUrlId(uuid: string): string {
    if (!uuid) return uuid;
    
    // Already encrypted
    if (uuid.startsWith(URL_ID_PREFIX)) {
        return uuid;
    }
    
    try {
        const key = getUrlIdKey();
        // Use deterministic IV based on the UUID for consistent URLs
        // This means same UUID always produces same encrypted URL
        const ivSource = scryptSync(uuid, "url-iv", IV_LENGTH);
        const iv = ivSource;
        
        const cipher = createCipheriv(ALGORITHM, key, iv);
        let encrypted = cipher.update(uuid, "utf8", "base64");
        encrypted += cipher.final("base64");
        
        // Combine IV and encrypted data, make URL-safe
        const combined = iv.toString("base64") + "." + encrypted;
        return URL_ID_PREFIX + toUrlSafeBase64(combined);
    } catch (error) {
        console.error("URL ID encryption failed:", error);
        // Fallback to original ID (don't break the app)
        return uuid;
    }
}

/**
 * Decrypt a URL ID back to the original UUID
 * 
 * @example
 * const uuid = decryptUrlId("s_abc123xyz...");
 * // Returns: "123e4567-e89b-12d3-a456-426614174000"
 */
export function decryptUrlId(encryptedId: string): string {
    if (!encryptedId) return encryptedId;
    
    // Not encrypted (plain UUID)
    if (!encryptedId.startsWith(URL_ID_PREFIX)) {
        return encryptedId;
    }
    
    try {
        const key = getUrlIdKey();
        
        // Remove prefix and convert from URL-safe base64
        const data = encryptedId.slice(URL_ID_PREFIX.length);
        const combined = fromUrlSafeBase64(data);
        
        // Split IV and encrypted data
        const parts = combined.split(".");
        if (parts.length !== 2) {
            throw new Error("Invalid encrypted URL ID format");
        }
        
        const [ivBase64, encryptedData] = parts;
        const iv = Buffer.from(ivBase64, "base64");
        
        const decipher = createDecipheriv(ALGORITHM, key, iv);
        let decrypted = decipher.update(encryptedData, "base64", "utf8");
        decrypted += decipher.final("utf8");
        
        return decrypted;
    } catch (error) {
        console.error("URL ID decryption failed:", error);
        // Return as-is (might be a plain UUID)
        return encryptedId;
    }
}

/**
 * Check if an ID is encrypted
 */
export function isEncryptedUrlId(id: string): boolean {
    return id?.startsWith(URL_ID_PREFIX) || false;
}

/**
 * Middleware helper to decrypt route params
 * Use in page components to get real IDs from encrypted URL params
 */
export function decryptParams<T extends Record<string, string>>(
    params: T,
    fields: (keyof T)[] = ["id"]
): T {
    const result = { ...params };
    
    for (const field of fields) {
        if (result[field] && typeof result[field] === "string") {
            result[field] = decryptUrlId(result[field] as string) as T[keyof T];
        }
    }
    
    return result;
}

/**
 * Helper to create encrypted URLs
 * 
 * @example
 * const url = createEncryptedUrl("/groups/[id]", { id: "uuid-here" });
 * // Returns: "/groups/s_encrypted..."
 */
export function createEncryptedUrl(
    pattern: string,
    params: Record<string, string>
): string {
    let url = pattern;
    
    for (const [key, value] of Object.entries(params)) {
        const encrypted = encryptUrlId(value);
        url = url.replace(`[${key}]`, encrypted);
    }
    
    return url;
}

