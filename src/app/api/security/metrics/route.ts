import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSecurityMetrics, getRecentAlerts } from "@/lib/security-monitor";
import { getCacheHeaders } from "@/lib/cache-headers";
import { logger } from "@/lib/logger";

/**
 * GET /api/security/metrics
 * 
 * Returns security metrics and recent alerts.
 * Only accessible to authenticated users (for their own data)
 * or admins (for system-wide data).
 * 
 * In production, this should be restricted to admin users only.
 */
export async function GET() {
    // Only allow in development or for authenticated users
    const isProduction = process.env.NODE_ENV === "production";
    
    if (isProduction) {
        // In production, require authentication
        const supabase = await createClient();
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error || !user) {
            return NextResponse.json(
                { error: "Authentication required" },
                { status: 401 }
            );
        }
        
        // TODO: Add admin role check here
        // For now, allow any authenticated user in production
    }
    
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
        
        return NextResponse.json(
            { error: "Failed to retrieve security metrics" },
            { status: 500 }
        );
    }
}

