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

import { createRoute, withCronAuth, ApiResponse, ApiError } from "@/lib/api";
import { queueAllWeeklyDigests } from "@/lib/email-digest";
import { log } from "@/lib/console-logger";

const handler = createRoute()
    .use(withCronAuth())
    .handler(async () => {
        const startTime = Date.now();

        try {
            log.info("Cron", "Starting weekly digest generation");

            const result = await queueAllWeeklyDigests();

            const duration = Date.now() - startTime;

            log.info("Cron", "Digest generation complete", { duration, ...result });

            return ApiResponse.success({
                success: true,
                ...result,
                duration_ms: duration,
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            log.error("Cron", "Digest generation failed", error);

            return ApiError.internal(error instanceof Error ? error.message : "Unknown error");
        }
    });

// Support both GET and POST for cron flexibility
export const GET = handler;
export const POST = handler;
