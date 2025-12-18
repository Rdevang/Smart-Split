/**
 * Input Validation & Sanitization Library
 * 
 * Provides centralized validation and sanitization for all user inputs
 * to prevent XSS, SQL injection, and other attacks.
 * 
 * SECURITY PRINCIPLES:
 * 1. Validate ALL inputs before processing
 * 2. Sanitize ALL outputs before storage/display
 * 3. Whitelist allowed characters, don't blacklist
 * 4. Apply length limits to prevent DoS
 */

import { z } from "zod";

// ============================================
// LENGTH LIMITS
// ============================================
// These limits prevent DoS attacks via large payloads

export const InputLimits = {
    // User inputs
    name: { min: 1, max: 100 },
    email: { min: 5, max: 254 },
    password: { min: 8, max: 128 },
    phone: { min: 7, max: 20 },

    // Text fields
    title: { min: 1, max: 200 },
    description: { min: 0, max: 5000 },
    note: { min: 0, max: 1000 },
    comment: { min: 0, max: 2000 },

    // IDs and codes
    uuid: { min: 36, max: 36 },
    inviteCode: { min: 8, max: 8 },
    otp: { min: 6, max: 6 },

    // Financial
    amount: { min: 0, max: 999999999.99 }, // ~$1 billion max
    currency: { min: 3, max: 3 },

    // Arrays and objects
    maxArrayItems: 100,
    maxJsonDepth: 5,
    maxTotalSize: 1024 * 1024, // 1MB
} as const;

// ============================================
// SANITIZATION FUNCTIONS
// ============================================

/**
 * Sanitize string to prevent XSS attacks
 * Escapes HTML special characters
 */
export function sanitizeHtml(input: string): string {
    if (!input || typeof input !== "string") return "";

    const htmlEscapes: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#x27;",
        "/": "&#x2F;",
        "`": "&#x60;",
        "=": "&#x3D;",
    };

    return input.replace(/[&<>"'`=/]/g, (char) => htmlEscapes[char] || char);
}

/**
 * Strip all HTML tags from input
 * Use when HTML is not needed at all
 */
export function stripHtml(input: string): string {
    if (!input || typeof input !== "string") return "";
    return input.replace(/<[^>]*>/g, "");
}

/**
 * Sanitize for safe database storage
 * Removes null bytes and normalizes unicode
 */
export function sanitizeForDb(input: string): string {
    if (!input || typeof input !== "string") return "";

    return input
        // Remove null bytes
        .replace(/\0/g, "")
        // Normalize unicode
        .normalize("NFC")
        // Trim whitespace
        .trim();
}

/**
 * Sanitize filename to prevent path traversal
 */
export function sanitizeFilename(filename: string): string {
    if (!filename || typeof filename !== "string") return "";

    return filename
        // Remove path separators
        .replace(/[\/\\]/g, "")
        // Remove null bytes
        .replace(/\0/g, "")
        // Remove special characters
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        // Limit length
        .slice(0, 255);
}

/**
 * Sanitize URL to prevent open redirect and javascript: URIs
 */
export function sanitizeUrl(url: string): string | null {
    if (!url || typeof url !== "string") return null;

    try {
        const parsed = new URL(url, "https://example.com");

        // Block dangerous protocols
        const dangerousProtocols = ["javascript:", "data:", "vbscript:", "file:"];
        if (dangerousProtocols.some(p => parsed.protocol.toLowerCase().startsWith(p))) {
            return null;
        }

        return url;
    } catch {
        // If not a valid URL, check if it's a relative path
        if (url.startsWith("/") && !url.startsWith("//")) {
            return url;
        }
        return null;
    }
}

/**
 * Deep sanitize an object - recursively sanitize all string values
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
    if (!obj || typeof obj !== "object") return obj;

    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === "string") {
            result[key] = sanitizeForDb(sanitizeHtml(value));
        } else if (Array.isArray(value)) {
            result[key] = value.map(item =>
                typeof item === "string"
                    ? sanitizeForDb(sanitizeHtml(item))
                    : typeof item === "object" && item !== null
                        ? sanitizeObject(item as Record<string, unknown>)
                        : item
            );
        } else if (typeof value === "object" && value !== null) {
            result[key] = sanitizeObject(value as Record<string, unknown>);
        } else {
            result[key] = value;
        }
    }

    return result as T;
}

// ============================================
// VALIDATION SCHEMAS
// ============================================

/**
 * Common Zod schemas for reuse across the application
 */
export const ValidationSchemas = {
    // User identification
    uuid: z.string()
        .length(36, "Invalid ID format")
        .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid UUID format"),

    email: z.string()
        .min(InputLimits.email.min, "Email is required")
        .max(InputLimits.email.max, "Email is too long")
        .email("Invalid email format")
        .toLowerCase()
        .transform(sanitizeForDb),

    name: z.string()
        .min(InputLimits.name.min, "Name is required")
        .max(InputLimits.name.max, "Name is too long")
        .transform(v => sanitizeForDb(stripHtml(v))),

    phone: z.string()
        .min(InputLimits.phone.min, "Phone number is too short")
        .max(InputLimits.phone.max, "Phone number is too long")
        .regex(/^[+\d\s()-]+$/, "Invalid phone format")
        .transform(sanitizeForDb),

    // Text content
    title: z.string()
        .min(InputLimits.title.min, "Title is required")
        .max(InputLimits.title.max, "Title is too long")
        .transform(v => sanitizeForDb(stripHtml(v))),

    description: z.string()
        .max(InputLimits.description.max, "Description is too long")
        .transform(v => sanitizeForDb(stripHtml(v)))
        .optional()
        .default(""),

    note: z.string()
        .max(InputLimits.note.max, "Note is too long")
        .transform(v => sanitizeForDb(stripHtml(v)))
        .optional()
        .default(""),

    // Financial
    amount: z.number()
        .min(0, "Amount must be positive")
        .max(InputLimits.amount.max, "Amount is too large")
        .transform(v => Math.round(v * 100) / 100), // Round to 2 decimal places

    currency: z.string()
        .length(3, "Currency must be 3 characters")
        .toUpperCase()
        .regex(/^[A-Z]{3}$/, "Invalid currency code"),

    // Codes
    inviteCode: z.string()
        .length(InputLimits.inviteCode.min, "Invalid invite code")
        .regex(/^[A-Z0-9]+$/i, "Invalid invite code format")
        .toUpperCase(),

    otp: z.string()
        .length(InputLimits.otp.min, "OTP must be 6 digits")
        .regex(/^\d{6}$/, "OTP must be 6 digits"),
};

// ============================================
// FORM DATA VALIDATION
// ============================================

/**
 * Validate and sanitize FormData
 * Returns null if validation fails
 */
export function validateFormData<T extends z.ZodType>(
    formData: FormData,
    schema: T
): z.infer<T> | null {
    try {
        // Convert FormData to object
        const data: Record<string, unknown> = {};

        for (const [key, value] of formData.entries()) {
            // Handle multiple values with same key (arrays)
            if (data[key]) {
                if (Array.isArray(data[key])) {
                    (data[key] as unknown[]).push(value);
                } else {
                    data[key] = [data[key], value];
                }
            } else {
                data[key] = value;
            }
        }

        // Validate against schema
        const result = schema.safeParse(data);

        if (!result.success) {
            console.warn("Form validation failed:", result.error.issues);
            return null;
        }

        return result.data;
    } catch (error) {
        console.error("Form data validation error:", error);
        return null;
    }
}

// ============================================
// SPECIFIC VALIDATORS
// ============================================

/**
 * Validate expense input
 */
export const ExpenseInputSchema = z.object({
    description: ValidationSchemas.title,
    amount: z.string()
        .transform(v => parseFloat(v))
        .pipe(ValidationSchemas.amount),
    category: z.string()
        .max(50, "Category too long")
        .transform(sanitizeForDb),
    group_id: ValidationSchemas.uuid,
    paid_by: ValidationSchemas.uuid.optional(),
    paid_by_placeholder_id: ValidationSchemas.uuid.optional(),
    expense_date: z.string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
    split_type: z.enum(["equal", "exact", "percentage"]),
    note: ValidationSchemas.note,
});

/**
 * Validate group input
 */
export const GroupInputSchema = z.object({
    name: ValidationSchemas.title,
    description: ValidationSchemas.description,
    currency: ValidationSchemas.currency.optional().default("USD"),
});

/**
 * Validate settlement input
 */
export const SettlementInputSchema = z.object({
    group_id: ValidationSchemas.uuid,
    from_user: ValidationSchemas.uuid.optional(),
    from_placeholder_id: ValidationSchemas.uuid.optional(),
    to_user: ValidationSchemas.uuid.optional(),
    to_placeholder_id: ValidationSchemas.uuid.optional(),
    amount: z.string()
        .transform(v => parseFloat(v))
        .pipe(ValidationSchemas.amount),
    note: ValidationSchemas.note,
});

/**
 * Validate feedback input
 */
export const FeedbackInputSchema = z.object({
    title: z.string()
        .min(5, "Title must be at least 5 characters")
        .max(100, "Title must be less than 100 characters")
        .transform(v => sanitizeForDb(stripHtml(v))),
    description: z.string()
        .min(10, "Description must be at least 10 characters")
        .max(1000, "Description must be less than 1000 characters")
        .transform(v => sanitizeForDb(stripHtml(v))),
    type: z.enum(["suggestion", "feature_request", "bug_report", "other"]),
    priority: z.enum(["low", "medium", "high", "critical"]).optional(),
    email: ValidationSchemas.email.optional(),
    name: ValidationSchemas.name.optional(),
});

/**
 * Validate profile update input
 */
export const ProfileInputSchema = z.object({
    full_name: ValidationSchemas.name,
    phone: ValidationSchemas.phone.optional(),
    preferred_currency: ValidationSchemas.currency.optional(),
});

// ============================================
// MIDDLEWARE HELPER
// ============================================

/**
 * Create a validation middleware for API routes
 */
export function createValidator<T extends z.ZodType>(schema: T) {
    return async (request: Request): Promise<{ data: z.infer<T> } | { error: string }> => {
        try {
            const contentType = request.headers.get("content-type") || "";

            let rawData: unknown;

            if (contentType.includes("application/json")) {
                rawData = await request.json();
            } else if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
                const formData = await request.formData();
                rawData = Object.fromEntries(formData.entries());
            } else {
                return { error: "Unsupported content type" };
            }

            // Check total size (rough estimate)
            const jsonString = JSON.stringify(rawData);
            if (jsonString.length > InputLimits.maxTotalSize) {
                return { error: "Request payload too large" };
            }

            const result = schema.safeParse(rawData);

            if (!result.success) {
                return { error: result.error.issues[0]?.message || "Validation failed" };
            }

            return { data: result.data };
        } catch (error) {
            console.error("Validation error:", error);
            return { error: "Invalid request data" };
        }
    };
}

// ============================================
// SQL SAFE HELPERS
// ============================================

/**
 * Safely join UUIDs for SQL IN clause
 * ONLY use with validated UUIDs
 */
export function safeUuidList(uuids: string[]): string[] {
    // Validate each UUID
    return uuids.filter(uuid =>
        ValidationSchemas.uuid.safeParse(uuid).success
    );
}

/**
 * Build safe Supabase OR filter
 * Prevents SQL injection by validating all IDs
 */
export function buildSafeOrFilter(
    column: string,
    values: string[],
    operator: "eq" | "in" = "eq"
): string | null {
    // Validate column name (only allow alphanumeric and underscore)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
        console.error("Invalid column name:", column);
        return null;
    }

    // Validate each value as UUID
    const validValues = safeUuidList(values);

    if (validValues.length === 0) return null;

    if (operator === "eq" && validValues.length === 1) {
        return `${column}.eq.${validValues[0]}`;
    }

    return `${column}.in.(${validValues.join(",")})`;
}

