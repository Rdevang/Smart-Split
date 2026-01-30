/**
 * GET /api/settings/recaptcha
 * 
 * Returns whether reCAPTCHA is enabled.
 * This is a public endpoint so clients know whether to load the script.
 * 
 * NOTE: Imports directly from route-builder to avoid pulling in rate-limit
 * middleware dependencies that cause issues in tests.
 */

import { createRoute } from "@/lib/api/route-builder";
import { ApiResponse } from "@/lib/api-responses";

export const GET = createRoute()
    .handler(async (ctx) => {
        try {
            const { data, error } = await ctx.supabase
                .from("app_settings")
                .select("is_enabled")
                .eq("key", "recaptcha")
                .single();

            if (error) {
                // If settings don't exist, reCAPTCHA is disabled
                return ApiResponse.success({ enabled: false });
            }

            return ApiResponse.success({
                enabled: data?.is_enabled ?? false,
                siteKey: data?.is_enabled ? process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY : null,
            });
        } catch {
            // On any error, return disabled (fail open)
            return ApiResponse.success({ enabled: false });
        }
    });
