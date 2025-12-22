/**
 * Email Queue Processor Cron Endpoint
 * 
 * Should be called every 1-5 minutes by a cron service (Vercel Cron, GitHub Actions, etc.)
 * 
 * Example Vercel cron config (vercel.json):
 * {
 *   "crons": [
 *     { "path": "/api/cron/emails", "schedule": "* * * * *" }
 *   ]
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { processEmailQueue } from "@/lib/email-queue";

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
        const result = await processEmailQueue();

        const duration = Date.now() - startTime;

        return NextResponse.json({
            success: true,
            ...result,
            duration_ms: duration,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error("[Cron/Emails] Error:", error);

        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            duration_ms: Date.now() - startTime,
        }, { status: 500 });
    }
}

// Also support POST for flexibility
export { GET as POST };

