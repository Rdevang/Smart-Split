/**
 * Centralized Console Logger
 * 
 * Provides consistent logging across the entire codebase with:
 * - Consistent prefix format: [Module] Message
 * - Log levels: debug, info, warn, error
 * - Environment-based filtering (debug only in development)
 * - Sensitive data sanitization
 * - Structured error logging
 * 
 * USAGE:
 *   import { log } from "@/lib/console-logger";
 *   
 *   log.info("Cache", "Invalidated group cache");
 *   log.error("Expenses", "Failed to fetch", error);
 *   log.debug("Auth", "Session refreshed"); // Only in development
 *   log.warn("Redis", "Circuit breaker open");
 * 
 * SECURITY: Never log user IDs, group IDs, or other record identifiers.
 *           Use generic descriptions instead.
 */

// ============================================
// ENVIRONMENT DETECTION
// ============================================

const isDev = process.env.NODE_ENV === "development";
const isTest = process.env.NODE_ENV === "test";

// ============================================
// SENSITIVE DATA PATTERNS
// ============================================

/**
 * Keys that should be redacted in objects
 */
const SENSITIVE_KEYS = new Set([
    "password",
    "token",
    "secret",
    "apiKey",
    "api_key",
    "authorization",
    "cookie",
    "session",
    "creditCard",
    "credit_card",
    "ssn",
    "accessToken",
    "access_token",
    "refreshToken",
    "refresh_token",
]);

// ============================================
// SANITIZATION HELPERS
// ============================================

/**
 * Redact a UUID, keeping first 8 chars for debugging
 */
function redactUuid(uuid: string): string {
    return uuid.replace(
        /([a-f0-9]{8})-([a-f0-9]{4})-([a-f0-9]{4})-([a-f0-9]{4})-([a-f0-9]{12})/gi,
        "$1-****-****-****-************"
    );
}

/**
 * Redact an email, keeping first 2 chars
 */
function redactEmail(email: string): string {
    return email.replace(
        /([a-zA-Z0-9._%+-]{2})[a-zA-Z0-9._%+-]*@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
        "$1***@$2"
    );
}

/**
 * Sanitize a string value
 */
function sanitizeString(value: string): string {
    let result = value;

    // Redact UUIDs
    result = redactUuid(result);

    // Redact emails
    result = redactEmail(result);

    // Redact JWT tokens
    result = result.replace(
        /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
        "[REDACTED_TOKEN]"
    );

    // Redact API keys
    result = result.replace(/sk_[a-zA-Z0-9]{20,}/g, "sk_[REDACTED]");
    result = result.replace(/pk_[a-zA-Z0-9]{20,}/g, "pk_[REDACTED]");

    return result;
}

/**
 * Sanitize an object, redacting sensitive keys and values
 */
function sanitizeObject(obj: unknown, depth = 0): unknown {
    // Prevent infinite recursion
    if (depth > 5) return "[MAX_DEPTH]";

    if (obj === null || obj === undefined) {
        return obj;
    }

    if (typeof obj === "string") {
        return sanitizeString(obj);
    }

    if (typeof obj === "number" || typeof obj === "boolean") {
        return obj;
    }

    if (obj instanceof Error) {
        return {
            name: obj.name,
            message: sanitizeString(obj.message),
            // Don't include stack in production
            ...(isDev && { stack: obj.stack?.split("\n").slice(0, 5).join("\n") }),
        };
    }

    if (Array.isArray(obj)) {
        return obj.slice(0, 10).map((item) => sanitizeObject(item, depth + 1));
    }

    if (typeof obj === "object") {
        const sanitized: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(obj)) {
            // Redact sensitive keys entirely
            if (SENSITIVE_KEYS.has(key.toLowerCase())) {
                sanitized[key] = "[REDACTED]";
                continue;
            }

            sanitized[key] = sanitizeObject(value, depth + 1);
        }

        return sanitized;
    }

    return String(obj);
}

/**
 * Sanitize error for logging
 */
export function sanitizeError(error: unknown): object {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: sanitizeString(error.message),
            ...(isDev && { stack: error.stack?.split("\n").slice(0, 5).join("\n") }),
        };
    }

    if (typeof error === "string") {
        return { message: sanitizeString(error) };
    }

    return { message: String(error) };
}

// ============================================
// LOG FORMATTING
// ============================================

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_COLORS = {
    debug: "\x1b[36m", // Cyan
    info: "\x1b[32m",  // Green
    warn: "\x1b[33m",  // Yellow
    error: "\x1b[31m", // Red
    reset: "\x1b[0m",
};

/**
 * Format the log message with consistent prefix
 */
function formatMessage(level: LogLevel, module: string, message: string): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${module}]`;

    // In development, add colors
    if (isDev && typeof window === "undefined") {
        const color = LOG_COLORS[level];
        return `${color}${timestamp} ${prefix}${LOG_COLORS.reset} ${message}`;
    }

    return `${timestamp} ${prefix} ${message}`;
}

/**
 * Format data for logging
 */
function formatData(data?: unknown): string {
    if (data === undefined) return "";

    const sanitized = sanitizeObject(data);

    try {
        return JSON.stringify(sanitized, null, isDev ? 2 : 0);
    } catch {
        return String(sanitized);
    }
}

// ============================================
// LOGGER INTERFACE
// ============================================

interface Logger {
    /**
     * Debug level - only logged in development
     */
    debug(module: string, message: string, data?: unknown): void;

    /**
     * Info level - general information
     */
    info(module: string, message: string, data?: unknown): void;

    /**
     * Warn level - potential issues
     */
    warn(module: string, message: string, data?: unknown): void;

    /**
     * Error level - errors and failures
     */
    error(module: string, message: string, error?: unknown): void;
}

// ============================================
// LOGGER IMPLEMENTATION
// ============================================

export const log: Logger = {
    debug(module: string, message: string, data?: unknown): void {
        // Only log debug in development, skip in tests to reduce noise
        if (!isDev || isTest) return;

        const formatted = formatMessage("debug", module, message);
        const dataStr = formatData(data);

        if (dataStr) {
            console.log(formatted, dataStr);
        } else {
            console.log(formatted);
        }
    },

    info(module: string, message: string, data?: unknown): void {
        // Skip info logs in tests to reduce noise
        if (isTest) return;

        const formatted = formatMessage("info", module, message);
        const dataStr = formatData(data);

        if (dataStr) {
            console.log(formatted, dataStr);
        } else {
            console.log(formatted);
        }
    },

    warn(module: string, message: string, data?: unknown): void {
        const formatted = formatMessage("warn", module, message);
        const dataStr = formatData(data);

        if (dataStr) {
            console.warn(formatted, dataStr);
        } else {
            console.warn(formatted);
        }
    },

    error(module: string, message: string, error?: unknown): void {
        const formatted = formatMessage("error", module, message);

        if (error !== undefined) {
            const sanitized = sanitizeError(error);
            console.error(formatted, JSON.stringify(sanitized, null, isDev ? 2 : 0));
        } else {
            console.error(formatted);
        }
    },
};

// ============================================
// MODULE-SPECIFIC LOGGERS (for convenience)
// ============================================

/**
 * Create a module-specific logger
 * 
 * USAGE:
 *   const logger = createModuleLogger("Cache");
 *   logger.info("Key invalidated", { key });
 */
export function createModuleLogger(module: string) {
    return {
        debug: (message: string, data?: unknown) => log.debug(module, message, data),
        info: (message: string, data?: unknown) => log.info(module, message, data),
        warn: (message: string, data?: unknown) => log.warn(module, message, data),
        error: (message: string, error?: unknown) => log.error(module, message, error),
    };
}

// Pre-created module loggers for common modules
export const cacheLog = createModuleLogger("Cache");
export const authLog = createModuleLogger("Auth");
export const apiLog = createModuleLogger("API");
export const dbLog = createModuleLogger("DB");
export const aiLog = createModuleLogger("AI");
