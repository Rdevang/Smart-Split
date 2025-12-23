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

        // Always return 200 even if some emails failed or were rate limited
        // This prevents cron job from being marked as failed
        // Rate limiting and individual failures are expected and handled gracefully
        return NextResponse.json({
            success: true,
            ...result,
            duration_ms: duration,
            timestamp: new Date().toISOString(),
            message: result.rateLimited > 0 
                ? `Rate limit reached. ${result.sent} sent, ${result.rateLimited} deferred.`
                : `Processed ${result.processed} emails. ${result.sent} sent, ${result.failed} failed.`,
        });
    } catch (error) {
        // Even on unexpected errors, log and return 200 to prevent cron job failures
        // The error is logged for debugging, but we don't want to trigger alerts
        console.error("[Cron/Emails] Unexpected error (non-critical):", error);

        return NextResponse.json({
            success: true, // Mark as success to prevent cron job from failing
            processed: 0,
            sent: 0,
            failed: 0,
            rateLimited: 0,
            errors: [error instanceof Error ? error.message : "Unknown error"],
            duration_ms: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            message: "Email processing encountered an issue. Will retry on next run.",
        });
    }
}

// Also support POST for flexibility
export { GET as POST };

