import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * POST /api/cron/cleanup
 * 
 * Scheduled cleanup job that runs daily at 3 AM UTC.
 * Configured in vercel.json crons.
 * 
 * Tasks:
 * 1. Permanently delete soft-deleted records older than 30 days
 * 2. Clean up expired sessions
 * 3. Purge old audit logs (older than 1 year)
 * 4. Clean up orphaned files in storage
 */
export async function POST(request: Request) {
    // Verify this is a legitimate cron request from Vercel
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // In production, require CRON_SECRET for authentication
    if (process.env.NODE_ENV === "production") {
        if (!cronSecret) {
            logger.error("CRON_SECRET not configured for production");
            return NextResponse.json(
                { error: "Cron not configured" },
                { status: 500 }
            );
        }

        if (authHeader !== `Bearer ${cronSecret}`) {
            logger.warn("Unauthorized cron attempt", {
                authHeader: authHeader ? "present" : "missing",
            });
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }
    }

    const results: Record<string, unknown> = {
        startedAt: new Date().toISOString(),
        tasks: {},
    };

    try {
        const supabase = await createClient();

        // Task 1: Clean up soft-deleted records (30+ days old)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const deleteThreshold = thirtyDaysAgo.toISOString();

        // Delete old groups
        const { data: deletedGroupsData } = await supabase
            .from("groups")
            .delete()
            .lt("deleted_at", deleteThreshold)
            .not("deleted_at", "is", null)
            .select("id");
        const deletedGroups = deletedGroupsData?.length || 0;

        // Delete old expenses
        const { data: deletedExpensesData } = await supabase
            .from("expenses")
            .delete()
            .lt("deleted_at", deleteThreshold)
            .not("deleted_at", "is", null)
            .select("id");
        const deletedExpenses = deletedExpensesData?.length || 0;

        // Delete old settlements
        const { data: deletedSettlementsData } = await supabase
            .from("settlements")
            .delete()
            .lt("deleted_at", deleteThreshold)
            .not("deleted_at", "is", null)
            .select("id");
        const deletedSettlements = deletedSettlementsData?.length || 0;

        results.tasks = {
            softDeletes: {
                groups: deletedGroups,
                expenses: deletedExpenses,
                settlements: deletedSettlements,
            },
        };

        // Task 2: Clean up old audit logs (1 year+)
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const { data: deletedAuditLogsData } = await supabase
            .from("audit_logs")
            .delete()
            .lt("created_at", oneYearAgo.toISOString())
            .select("id");

        (results.tasks as Record<string, unknown>).auditLogs = {
            deleted: deletedAuditLogsData?.length || 0,
        };

        // Task 3: Clean up old activities (90 days+)
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        const { data: deletedActivitiesData } = await supabase
            .from("activities")
            .delete()
            .lt("created_at", ninetyDaysAgo.toISOString())
            .select("id");

        (results.tasks as Record<string, unknown>).activities = {
            deleted: deletedActivitiesData?.length || 0,
        };

        // Task 4: Clean up expired notifications (30 days+)
        const { data: deletedNotificationsData } = await supabase
            .from("notifications")
            .delete()
            .eq("is_read", true)
            .lt("created_at", deleteThreshold)
            .select("id");

        (results.tasks as Record<string, unknown>).notifications = {
            deleted: deletedNotificationsData?.length || 0,
        };

        results.completedAt = new Date().toISOString();
        results.success = true;

        logger.info("Cleanup cron completed successfully", results);

        return NextResponse.json(results);

    } catch (error) {
        logger.error("Cleanup cron failed", error instanceof Error ? error : new Error(String(error)));

        return NextResponse.json(
            {
                error: "Cleanup failed",
                details: process.env.NODE_ENV === "development"
                    ? (error instanceof Error ? error.message : String(error))
                    : undefined,
            },
            { status: 500 }
        );
    }
}

// Also support GET for manual testing in development
export async function GET(request: Request) {
    if (process.env.NODE_ENV === "production") {
        return NextResponse.json(
            { error: "Use POST for cron jobs" },
            { status: 405 }
        );
    }

    // In development, allow GET for testing
    return POST(request);
}

