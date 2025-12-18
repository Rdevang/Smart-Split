import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { getCacheHeaders } from "@/lib/cache-headers";
import { logger } from "@/lib/logger";

/**
 * GET /api/cache/health
 * Health check endpoint to verify Redis connection
 * 
 * Uses stale-if-error so monitoring tools still get a response
 * even if Redis is temporarily down.
 */
export async function GET() {
    const redis = getRedis();
    
    if (!redis) {
        return NextResponse.json({
            status: "not_configured",
            message: "Redis is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.",
            caching: false,
            timestamp: new Date().toISOString(),
        }, { 
            status: 200,
            headers: getCacheHeaders("public-dynamic"), // CDN can serve stale if backend down
        });
    }

    try {
        // Test write
        const testKey = "health:check";
        const testValue = `ping-${Date.now()}`;
        await redis.set(testKey, testValue, { ex: 60 }); // Expires in 60 seconds
        
        // Test read
        const readValue = await redis.get(testKey);
        
        // Test delete
        await redis.del(testKey);

        if (readValue === testValue) {
            return NextResponse.json({
                status: "healthy",
                message: "Redis is working correctly!",
                caching: true,
                test: {
                    write: "✅ Success",
                    read: "✅ Success", 
                    delete: "✅ Success",
                },
                timestamp: new Date().toISOString(),
            }, { 
                status: 200,
                headers: getCacheHeaders("public-dynamic"),
            });
        } else {
            return NextResponse.json({
                status: "error",
                message: "Redis read/write mismatch",
                caching: false,
                timestamp: new Date().toISOString(),
            }, { 
                status: 500,
                headers: getCacheHeaders("public-dynamic"),
            });
        }
    } catch (error) {
        // SECURITY: Log full error internally, return safe message to client
        logger.error("Cache health check failed", error instanceof Error ? error : new Error(String(error)));
        
        return NextResponse.json({
            status: "error",
            // SECURITY: Don't expose internal error details
            message: "Cache connection error. Please try again later.",
            caching: false,
            timestamp: new Date().toISOString(),
        }, { 
            status: 500,
            headers: getCacheHeaders("public-dynamic"),
        });
    }
}

