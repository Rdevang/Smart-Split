/**
 * GET /api/reviews
 * 
 * Fetches latest approved reviews with rating 4 or higher.
 * Public endpoint - no auth required.
 */

import { createRoute, ApiResponse } from "@/lib/api";
import { log } from "@/lib/console-logger";

export const revalidate = 3600; // Cache for 1 hour

export const GET = createRoute()
    .handler(async (ctx) => {
        // Fetch latest 4 approved reviews with rating 4 or higher
        const { data: reviews, error } = await ctx.supabase
            .from("reviews")
            .select("id, author_name, author_title, author_avatar_url, content, rating, created_at")
            .eq("is_approved", true)
            .gte("rating", 4)
            .order("created_at", { ascending: false })
            .limit(4);

        if (error) {
            log.error("Reviews", "Fetch error", error);
            return ApiResponse.success({ reviews: [] });
        }

        return ApiResponse.success({ reviews: reviews || [] });
    });
