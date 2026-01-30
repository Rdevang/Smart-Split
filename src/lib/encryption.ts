/**
 * Encryption utilities for sensitive data (UPI IDs, etc.)
 * Uses AES-256-GCM encryption with a secret key from environment variables
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import { log } from "./console-logger";

// Encryption configuration
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits for GCM
const KEY_LENGTH = 32; // 256 bits for AES-256

// Prefix to identify encrypted values
const ENCRYPTED_PREFIX = "enc:v1:";

/**
 * Get encryption key from environment
 * Falls back to a derived key from CSRF_SECRET if ENCRYPTION_KEY not set
 */
function getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY || process.env.CSRF_SECRET;

    if (!key) {
        throw new Error("ENCRYPTION_KEY or CSRF_SECRET environment variable is required for encryption");
    }

    // Derive a consistent 32-byte key using scrypt
    // Using a fixed salt so the same input always produces the same key
    const salt = Buffer.from("smart-split-encryption-salt-v1", "utf-8");
    return scryptSync(key, salt, KEY_LENGTH);
}

/**
 * Encrypt a string value
 * Format: enc:v1:<iv>:<authTag>:<ciphertext> (all base64 encoded)
 */
export function encrypt(plaintext: string): string {
    if (!plaintext) return plaintext;

    // Already encrypted
    if (plaintext.startsWith(ENCRYPTED_PREFIX)) {
        return plaintext;
    }

    try {
        const key = getEncryptionKey();
        const iv = randomBytes(IV_LENGTH);

        const cipher = createCipheriv(ALGORITHM, key, iv);

        let encrypted = cipher.update(plaintext, "utf8", "base64");
        encrypted += cipher.final("base64");

        const authTag = cipher.getAuthTag();

        // Format: prefix:iv:authTag:ciphertext
        return `${ENCRYPTED_PREFIX}${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`;
    } catch (error) {
        log.error("Encryption", "Encryption failed", error);
        throw new Error("Failed to encrypt data");
    }
}

/**
 * Decrypt an encrypted string value
 * Returns null on decryption failure (not empty string)
 */
export function decrypt(ciphertext: string): string | null {
    if (!ciphertext) return null;

    // Not encrypted (plain text or invalid format) - return as-is
    if (!ciphertext.startsWith(ENCRYPTED_PREFIX)) {
        return ciphertext;
    }

    try {
        const key = getEncryptionKey();

        // Remove prefix and split parts
        const data = ciphertext.slice(ENCRYPTED_PREFIX.length);
        const parts = data.split(":");

        if (parts.length !== 3) {
            throw new Error("Invalid encrypted data format");
        }

        const [ivBase64, authTagBase64, encryptedData] = parts;

        const iv = Buffer.from(ivBase64, "base64");
        const authTag = Buffer.from(authTagBase64, "base64");

        const decipher = createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encryptedData, "base64", "utf8");
        decrypted += decipher.final("utf8");

        return decrypted;
    } catch (error) {
        log.error("Encryption", "Decryption failed", error);
        // Return null on decryption failure so callers can handle it properly
        return null;
    }
}

/**
 * Check if a value is encrypted
 */
export function isEncrypted(value: string): boolean {
    return value?.startsWith(ENCRYPTED_PREFIX) || false;
}

/**
 * Encrypt sensitive fields in an object
 */
export function encryptFields<T extends Record<string, unknown>>(
    data: T,
    fieldsToEncrypt: (keyof T)[]
): T {
    const result = { ...data };

    for (const field of fieldsToEncrypt) {
        const value = result[field];
        if (typeof value === "string" && value) {
            result[field] = encrypt(value) as T[keyof T];
        }
    }

    return result;
}

/**
 * Decrypt sensitive fields in an object
 * Note: Fields that fail decryption will be set to null
 */
export function decryptFields<T extends Record<string, unknown>>(
    data: T,
    fieldsToDecrypt: (keyof T)[]
): T {
    const result = { ...data };

    for (const field of fieldsToDecrypt) {
        const value = result[field];
        if (typeof value === "string" && value) {
            const decrypted = decrypt(value);
            result[field] = (decrypted ?? null) as T[keyof T];
        }
    }

    return result;
}

