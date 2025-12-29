/**
 * Weekly Digest Cron Endpoint
 * 
 * Should be called once a week (e.g., Sunday at 9am)
 * 
 * Example Vercel cron config (vercel.json):
 * {
 *   "crons": [
 *     { "path": "/api/cron/digest", "schedule": "0 9 * * 0" }
 *   ]
 * }
 * 
 * Schedule: 0 9 * * 0 = Every Sunday at 9:00 AM UTC
 */

import { NextRequest, NextResponse } from "next/server";
import { queueAllWeeklyDigests } from "@/lib/email-digest";

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(request: NextRequest): boolean {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // If no secret configured, allow in development only
    if (!cronSecret) {
        return process.env.NODE_ENV === "development";
    }

    return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
    // Verify authorization
    if (!verifyCronSecret(request)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startTime = Date.now();

    try {
        console.log("[Cron/Digest] Starting weekly digest generation...");

        const result = await queueAllWeeklyDigests();

        const duration = Date.now() - startTime;

        console.log("[Cron/Digest] Complete in", duration, "ms:", result);

        return NextResponse.json({
            success: true,
            ...result,
            duration_ms: duration,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error("[Cron/Digest] Error:", error);

        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            duration_ms: Date.now() - startTime,
        }, { status: 500 });
    }
}

// Also support POST for flexibility
export { GET as POST };

