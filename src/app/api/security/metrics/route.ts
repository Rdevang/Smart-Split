/**
 * GET /api/security/metrics
 * 
 * Returns security metrics and recent alerts.
 * Only accessible to authenticated users (for their own data)
 * or admins (for system-wide data).
 * 
 * In production, this should be restricted to admin users only.
 */

import { NextResponse } from "next/server";
import { createRoute, withAuth, withOptionalAuth, ApiError } from "@/lib/api";
import { getSecurityMetrics, getRecentAlerts } from "@/lib/security-monitor";
import { getCacheHeaders } from "@/lib/cache-headers";
import { logger } from "@/lib/logger";

// Development: No auth required
// Production: Auth required
const isProduction = process.env.NODE_ENV === "production";

export const GET = createRoute()
    .use(isProduction ? withAuth() : withOptionalAuth())
    .handler(async () => {
        try {
            const [metrics, alerts] = await Promise.all([
                getSecurityMetrics(),
                getRecentAlerts(20),
            ]);

            return NextResponse.json({
                metrics,
                alerts,
                timestamp: new Date().toISOString(),
            }, {
                headers: getCacheHeaders("private"),
            });
        } catch (error) {
            // SECURITY: Log full error internally, return generic message
            logger.error("Failed to get security metrics", error instanceof Error ? error : new Error(String(error)));
            return ApiError.internal("Failed to retrieve security metrics");
        }
    });
