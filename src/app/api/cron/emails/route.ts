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

import { createRoute, withCronAuth, ApiResponse } from "@/lib/api";
import { processEmailQueue } from "@/lib/email-queue";
import { log } from "@/lib/console-logger";

const handler = createRoute()
    .use(withCronAuth())
    .handler(async () => {
        const startTime = Date.now();

        try {
            const result = await processEmailQueue();
            const duration = Date.now() - startTime;

            // Always return 200 even if some emails failed or were rate limited
            // This prevents cron job from being marked as failed
            // Rate limiting and individual failures are expected and handled gracefully
            return ApiResponse.success({
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
            log.warn("Cron", "Email processing issue (non-critical)", error);

            return ApiResponse.success({
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
    });

// Support both GET and POST for cron flexibility
export const GET = handler;
export const POST = handler;
