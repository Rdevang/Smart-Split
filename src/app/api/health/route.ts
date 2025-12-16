import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { getCacheHeaders } from "@/lib/cache-headers";

/**
 * GET /api/health
 * General health check endpoint for monitoring services
 * 
 * GRACEFUL DEGRADATION:
 * Uses stale-if-error=86400 (1 day) so that during a total outage,
 * the CDN can serve the last known healthy response.
 * 
 * This prevents monitoring dashboards from showing "site down"
 * when only the origin server is having temporary issues.
 */
export async function GET() {
    const startTime = Date.now();
    const checks: Record<string, "healthy" | "degraded" | "unhealthy"> = {};
    
    // Check Redis (optional, degraded if not available)
    const redis = getRedis();
    if (redis) {
        try {
            await redis.ping();
            checks.cache = "healthy";
        } catch {
            checks.cache = "unhealthy";
        }
    } else {
        checks.cache = "degraded"; // Not configured, but app works without it
    }
    
    // Overall status
    const unhealthyCount = Object.values(checks).filter(s => s === "unhealthy").length;
    const degradedCount = Object.values(checks).filter(s => s === "degraded").length;
    
    let status: "healthy" | "degraded" | "unhealthy";
    let httpStatus: number;
    
    if (unhealthyCount > 0) {
        status = "unhealthy";
        httpStatus = 503; // Service Unavailable
    } else if (degradedCount > 0) {
        status = "degraded";
        httpStatus = 200; // Still operational
    } else {
        status = "healthy";
        httpStatus = 200;
    }
    
    const responseTime = Date.now() - startTime;
    
    return NextResponse.json({
        status,
        version: process.env.npm_package_version || "1.0.0",
        environment: process.env.NODE_ENV || "development",
        checks,
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString(),
    }, {
        status: httpStatus,
        headers: getCacheHeaders("public-dynamic"),
    });
}

