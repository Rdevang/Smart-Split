/**
 * Structured Logging with PII Redaction
 * 
 * This module provides a centralized logging system that:
 * 1. Outputs structured JSON logs for easy parsing
 * 2. Automatically redacts PII (emails, IPs, tokens)
 * 3. Includes context (request ID, user ID, timestamp)
 * 4. Supports different log levels
 * 5. Works in both server and edge environments
 */

// ============================================
// PII PATTERNS FOR REDACTION
// ============================================

interface PIIPattern {
    pattern: RegExp;
    replacement: string;
    name: string;
}

const PII_PATTERNS: PIIPattern[] = [
    // Email addresses
    {
        pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        replacement: "[EMAIL_REDACTED]",
        name: "email",
    },
    // Phone numbers (various formats)
    {
        pattern: /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
        replacement: "[PHONE_REDACTED]",
        name: "phone",
    },
    // Credit card numbers
    {
        pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
        replacement: "[CARD_REDACTED]",
        name: "card",
    },
    // IP addresses (IPv4)
    {
        pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
        replacement: "[IP_REDACTED]",
        name: "ipv4",
    },
    // JWT tokens
    {
        pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
        replacement: "[TOKEN_REDACTED]",
        name: "jwt",
    },
    // Bearer tokens
    {
        pattern: /Bearer\s+[a-zA-Z0-9._-]+/gi,
        replacement: "Bearer [TOKEN_REDACTED]",
        name: "bearer",
    },
    // API keys (common patterns)
    {
        pattern: /(?:api[_-]?key|apikey|api[_-]?secret)[=:]\s*['"]?[a-zA-Z0-9_-]{20,}['"]?/gi,
        replacement: "[API_KEY_REDACTED]",
        name: "apikey",
    },
    // UUIDs (partial redaction - keep first 8 and last 4 chars for debugging)
    {
        pattern: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        replacement: "[UUID_REDACTED]",
        name: "uuid",
    },
    // Password fields in JSON
    {
        pattern: /"password"\s*:\s*"[^"]*"/gi,
        replacement: '"password": "[REDACTED]"',
        name: "password",
    },
];

// ============================================
// LOG LEVELS
// ============================================

export type LogLevel = "debug" | "info" | "warn" | "error" | "security";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    security: 4, // Always logged regardless of level
};

// Minimum log level (from environment or default to info in production)
const MIN_LOG_LEVEL: LogLevel = 
    (process.env.LOG_LEVEL as LogLevel) || 
    (process.env.NODE_ENV === "production" ? "info" : "debug");

// ============================================
// LOG ENTRY STRUCTURE
// ============================================

export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    service: string;
    requestId?: string;
    userId?: string;
    sessionId?: string;
    path?: string;
    method?: string;
    statusCode?: number;
    duration?: number;
    error?: {
        name: string;
        message: string;
        stack?: string;
    };
    metadata?: Record<string, unknown>;
    // Security-specific fields
    security?: {
        event: string;
        severity: "low" | "medium" | "high" | "critical";
        source?: string;
        target?: string;
        outcome: "success" | "failure" | "blocked";
        details?: Record<string, unknown>;
    };
}

// ============================================
// PII REDACTION
// ============================================

/**
 * Redact PII from a string
 */
export function redactPII(input: string): string {
    let result = input;
    
    for (const { pattern, replacement } of PII_PATTERNS) {
        result = result.replace(pattern, replacement);
    }
    
    return result;
}

/**
 * Redact PII from an object (deep)
 */
export function redactPIIFromObject<T>(obj: T): T {
    if (obj === null || obj === undefined) {
        return obj;
    }
    
    if (typeof obj === "string") {
        return redactPII(obj) as T;
    }
    
    if (Array.isArray(obj)) {
        return obj.map(item => redactPIIFromObject(item)) as T;
    }
    
    if (typeof obj === "object") {
        const result: Record<string, unknown> = {};
        
        for (const [key, value] of Object.entries(obj)) {
            // Completely redact sensitive fields
            const sensitiveFields = ["password", "token", "secret", "apiKey", "authorization"];
            if (sensitiveFields.some(f => key.toLowerCase().includes(f))) {
                result[key] = "[REDACTED]";
            } else {
                result[key] = redactPIIFromObject(value);
            }
        }
        
        return result as T;
    }
    
    return obj;
}

// ============================================
// LOGGER CLASS
// ============================================

class Logger {
    private service: string;
    private context: Partial<LogEntry>;
    
    constructor(service: string = "smart-split") {
        this.service = service;
        this.context = {};
    }
    
    /**
     * Create a child logger with additional context
     */
    child(context: Partial<LogEntry>): Logger {
        const child = new Logger(this.service);
        child.context = { ...this.context, ...context };
        return child;
    }
    
    /**
     * Set request context for correlation
     */
    setRequestContext(requestId: string, userId?: string, path?: string, method?: string): void {
        this.context = {
            ...this.context,
            requestId,
            userId,
            path,
            method,
        };
    }
    
    /**
     * Core logging function
     */
    private log(level: LogLevel, message: string, data?: Partial<LogEntry>): void {
        // Check if we should log at this level
        if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[MIN_LOG_LEVEL] && level !== "security") {
            return;
        }
        
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            message: redactPII(message),
            service: this.service,
            ...this.context,
            ...data,
        };
        
        // Redact PII from metadata
        if (entry.metadata) {
            entry.metadata = redactPIIFromObject(entry.metadata);
        }
        
        // Redact PII from security details
        if (entry.security?.details) {
            entry.security.details = redactPIIFromObject(entry.security.details);
        }
        
        // Output as JSON for structured logging
        const output = JSON.stringify(entry);
        
        switch (level) {
            case "debug":
                console.debug(output);
                break;
            case "info":
                console.info(output);
                break;
            case "warn":
                console.warn(output);
                break;
            case "error":
            case "security":
                console.error(output);
                break;
        }
    }
    
    // ============================================
    // PUBLIC LOGGING METHODS
    // ============================================
    
    debug(message: string, metadata?: Record<string, unknown>): void {
        this.log("debug", message, { metadata });
    }
    
    info(message: string, metadata?: Record<string, unknown>): void {
        this.log("info", message, { metadata });
    }
    
    warn(message: string, metadata?: Record<string, unknown>): void {
        this.log("warn", message, { metadata });
    }
    
    error(message: string, error?: Error, metadata?: Record<string, unknown>): void {
        this.log("error", message, {
            error: error ? {
                name: error.name,
                message: redactPII(error.message),
                stack: process.env.NODE_ENV !== "production" ? error.stack : undefined,
            } : undefined,
            metadata,
        });
    }
    
    /**
     * Log a security event (always logged regardless of level)
     */
    security(
        event: string,
        severity: "low" | "medium" | "high" | "critical",
        outcome: "success" | "failure" | "blocked",
        details?: Record<string, unknown>
    ): void {
        this.log("security", `Security Event: ${event}`, {
            security: {
                event,
                severity,
                outcome,
                details,
            },
        });
    }
    
    /**
     * Log an HTTP request/response
     */
    request(
        method: string,
        path: string,
        statusCode: number,
        duration: number,
        metadata?: Record<string, unknown>
    ): void {
        const level: LogLevel = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";
        
        this.log(level, `${method} ${path} ${statusCode} ${duration}ms`, {
            method,
            path,
            statusCode,
            duration,
            metadata,
        });
    }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

export const logger = new Logger("smart-split");

// ============================================
// SECURITY EVENT TYPES
// ============================================

export const SecurityEvents = {
    // Authentication
    LOGIN_SUCCESS: "auth.login.success",
    LOGIN_FAILURE: "auth.login.failure",
    LOGIN_BLOCKED: "auth.login.blocked",
    LOGOUT: "auth.logout",
    PASSWORD_CHANGE: "auth.password.change",
    PASSWORD_RESET_REQUEST: "auth.password.reset_request",
    PASSWORD_RESET_COMPLETE: "auth.password.reset_complete",
    MFA_ENABLED: "auth.mfa.enabled",
    MFA_DISABLED: "auth.mfa.disabled",
    
    // OAuth
    OAUTH_ATTEMPT: "auth.oauth.attempt",
    OAUTH_SUCCESS: "auth.oauth.success",
    OAUTH_FAILURE: "auth.oauth.failure",
    
    // Account Creation
    ACCOUNT_CREATION_ATTEMPT: "account.creation.attempt",
    
    // CSRF Protection
    CSRF_VIOLATION: "security.csrf.violation",
    
    // Authorization
    ACCESS_DENIED: "authz.access.denied",
    PERMISSION_ESCALATION: "authz.permission.escalation",
    
    // Rate Limiting
    RATE_LIMIT_EXCEEDED: "ratelimit.exceeded",
    RATE_LIMIT_WARNING: "ratelimit.warning",
    
    // Data Access
    SENSITIVE_DATA_ACCESS: "data.sensitive.access",
    BULK_DATA_EXPORT: "data.bulk.export",
    DATA_DELETION: "data.deletion",
    
    // Account
    ACCOUNT_CREATED: "account.created",
    ACCOUNT_DELETED: "account.deleted",
    ACCOUNT_LOCKED: "account.locked",
    ACCOUNT_UNLOCKED: "account.unlocked",
    
    // Suspicious Activity
    SUSPICIOUS_IP: "suspicious.ip",
    SUSPICIOUS_USER_AGENT: "suspicious.user_agent",
    SUSPICIOUS_PATTERN: "suspicious.pattern",
    BRUTE_FORCE_DETECTED: "suspicious.brute_force",
    
    // API
    API_KEY_CREATED: "api.key.created",
    API_KEY_REVOKED: "api.key.revoked",
    INVALID_API_KEY: "api.key.invalid",
} as const;

export type SecurityEventType = typeof SecurityEvents[keyof typeof SecurityEvents];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Create a logger with request context
 */
export function createRequestLogger(
    requestId: string,
    userId?: string,
    path?: string,
    method?: string
): Logger {
    return logger.child({ requestId, userId, path, method });
}

export default logger;

