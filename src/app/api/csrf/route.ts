/**
 * GET /api/csrf
 * 
 * Returns a fresh CSRF token.
 * Used by forms to get a new token before submission
 * to prevent expiration issues.
 */

import { createRoute, ApiResponse } from "@/lib/api";
import { createCsrfToken } from "@/lib/csrf";

export const GET = createRoute()
    .handler(async () => {
        const token = await createCsrfToken();
        return ApiResponse.success({ token });
    });
