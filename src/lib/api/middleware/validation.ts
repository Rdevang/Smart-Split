/**
 * Validation Middleware
 * 
 * Provides Zod-based validation middleware for request bodies and query params.
 * 
 * USAGE:
 *   // Validate request body
 *   const MySchema = z.object({ name: z.string() });
 *   
 *   createRoute()
 *       .use(withValidation(MySchema))
 *       .handler(async (ctx) => {
 *           // ctx.validated is typed as { name: string }
 *       });
 *   
 *   // Validate query params
 *   createRoute()
 *       .use(withQueryValidation(QuerySchema))
 *       .handler(async (ctx) => {
 *           // ctx.query is typed
 *       });
 */

import { z } from "zod";
import type { BaseContext, ValidatedContext, QueryValidatedContext, Middleware } from "../route-builder";
import { ApiError } from "@/lib/api-responses";

// ============================================
// TYPES
// ============================================

/**
 * Options for body validation
 */
export interface ValidationOptions {
    /** Maximum body size in bytes (default: 1MB) */
    maxSize?: number;
    /** Custom error message for size limit */
    sizeErrorMessage?: string;
}

/**
 * Options for query validation
 */
export interface QueryValidationOptions {
    /** Whether to parse numeric strings as numbers */
    parseNumbers?: boolean;
    /** Whether to parse "true"/"false" as booleans */
    parseBooleans?: boolean;
}

// ============================================
// BODY VALIDATION MIDDLEWARE
// ============================================

/**
 * Validate request body against a Zod schema
 * 
 * Adds `validated` to context with the parsed and validated data.
 * Returns 400 if validation fails, 413 if body too large.
 * 
 * USAGE:
 *   const CreateUserSchema = z.object({
 *       email: z.string().email(),
 *       name: z.string().min(1).max(100),
 *   });
 *   
 *   createRoute()
 *       .use(withValidation(CreateUserSchema))
 *       .handler(async (ctx) => {
 *           // ctx.validated is { email: string, name: string }
 *           const { email, name } = ctx.validated;
 *       });
 */
export function withValidation<T extends z.ZodType>(
    schema: T,
    options: ValidationOptions = {}
): Middleware<BaseContext, ValidatedContext<z.infer<T>>> {
    const { maxSize = 1024 * 1024, sizeErrorMessage } = options; // 1MB default

    return async (ctx) => {
        // Check content length if provided
        const contentLength = ctx.request.headers.get("content-length");
        if (contentLength && parseInt(contentLength) > maxSize) {
            return ApiError.custom(
                413,
                sizeErrorMessage || "Request body too large",
                "PAYLOAD_TOO_LARGE"
            );
        }

        // Parse body
        let body: unknown;
        try {
            body = await ctx.request.json();
        } catch {
            return ApiError.badRequest("Invalid JSON body");
        }

        // Validate against schema
        const result = schema.safeParse(body);

        if (!result.success) {
            // Format Zod errors into readable structure
            const errors: Record<string, string[]> = {};

            for (const issue of result.error.issues) {
                const path = issue.path.join(".") || "_root";
                if (!errors[path]) {
                    errors[path] = [];
                }
                errors[path].push(issue.message);
            }

            return ApiError.validation(errors);
        }

        return {
            ...ctx,
            validated: result.data,
        };
    };
}

/**
 * Validate request body with custom error message
 * 
 * Same as withValidation but allows custom error formatting.
 */
export function withValidationCustom<T extends z.ZodType>(
    schema: T,
    formatError: (error: z.ZodError) => { message: string; details?: Record<string, unknown> }
): Middleware<BaseContext, ValidatedContext<z.infer<T>>> {
    return async (ctx) => {
        let body: unknown;
        try {
            body = await ctx.request.json();
        } catch {
            return ApiError.badRequest("Invalid JSON body");
        }

        const result = schema.safeParse(body);

        if (!result.success) {
            const { message, details } = formatError(result.error);
            return ApiError.badRequest(message, details);
        }

        return {
            ...ctx,
            validated: result.data,
        };
    };
}

// ============================================
// QUERY VALIDATION MIDDLEWARE
// ============================================

/**
 * Validate query parameters against a Zod schema
 * 
 * Adds `query` to context with the parsed and validated data.
 * Returns 400 if validation fails.
 * 
 * USAGE:
 *   const QuerySchema = z.object({
 *       page: z.coerce.number().min(1).default(1),
 *       limit: z.coerce.number().min(1).max(100).default(20),
 *       search: z.string().optional(),
 *   });
 *   
 *   createRoute()
 *       .use(withQueryValidation(QuerySchema))
 *       .handler(async (ctx) => {
 *           // ctx.query is { page: number, limit: number, search?: string }
 *       });
 */
export function withQueryValidation<T extends z.ZodType>(
    schema: T,
    options: QueryValidationOptions = {}
): Middleware<BaseContext, QueryValidatedContext<z.infer<T>>> {
    const { parseNumbers = true, parseBooleans = true } = options;

    return async (ctx) => {
        // Convert URLSearchParams to object
        const searchParams = ctx.request.nextUrl.searchParams;
        const rawQuery: Record<string, string | string[]> = {};

        searchParams.forEach((value, key) => {
            // Handle array params (e.g., ?tags=a&tags=b)
            const existing = rawQuery[key];
            if (existing) {
                if (Array.isArray(existing)) {
                    existing.push(value);
                } else {
                    rawQuery[key] = [existing, value];
                }
            } else {
                rawQuery[key] = value;
            }
        });

        // Optionally parse numbers and booleans
        const query: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(rawQuery)) {
            if (typeof value === "string") {
                query[key] = parseValue(value, parseNumbers, parseBooleans);
            } else if (Array.isArray(value)) {
                query[key] = value.map((v) => parseValue(v, parseNumbers, parseBooleans));
            }
        }

        // Validate against schema
        const result = schema.safeParse(query);

        if (!result.success) {
            const errors: Record<string, string[]> = {};

            for (const issue of result.error.issues) {
                const path = issue.path.join(".") || "_root";
                if (!errors[path]) {
                    errors[path] = [];
                }
                errors[path].push(issue.message);
            }

            return ApiError.validation(errors);
        }

        return {
            ...ctx,
            query: result.data,
        };
    };
}

/**
 * Parse a string value to number or boolean if applicable
 */
function parseValue(
    value: string,
    parseNumbers: boolean,
    parseBooleans: boolean
): string | number | boolean {
    // Try boolean
    if (parseBooleans) {
        if (value === "true") return true;
        if (value === "false") return false;
    }

    // Try number
    if (parseNumbers && value !== "" && !isNaN(Number(value))) {
        return Number(value);
    }

    return value;
}

// ============================================
// COMBINED VALIDATION
// ============================================

/**
 * Validate both body and query params
 * 
 * USAGE:
 *   createRoute()
 *       .use(withBodyAndQuery(BodySchema, QuerySchema))
 *       .handler(async (ctx) => {
 *           // ctx.validated (body) and ctx.query (query params)
 *       });
 */
export function withBodyAndQuery<TBody extends z.ZodType, TQuery extends z.ZodType>(
    bodySchema: TBody,
    querySchema: TQuery
): Middleware<BaseContext, ValidatedContext<z.infer<TBody>> & QueryValidatedContext<z.infer<TQuery>>> {
    return async (ctx) => {
        // Validate query first (doesn't consume request body)
        const queryMiddleware = withQueryValidation(querySchema);
        const queryResult = await queryMiddleware(ctx);

        if (queryResult instanceof Response) {
            return queryResult;
        }

        // Validate body
        const bodyMiddleware = withValidation(bodySchema);
        const bodyResult = await bodyMiddleware(queryResult);

        if (bodyResult instanceof Response) {
            return bodyResult;
        }

        return bodyResult as ValidatedContext<z.infer<TBody>> & QueryValidatedContext<z.infer<TQuery>>;
    };
}

// ============================================
// COMMON SCHEMAS
// ============================================

/**
 * Common pagination query schema
 */
export const PaginationSchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
});

/**
 * Common UUID param schema
 */
export const UuidParamSchema = z.object({
    id: z.string().uuid(),
});

/**
 * Common date range query schema
 */
export const DateRangeSchema = z.object({
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
});
