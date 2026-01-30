/**
 * Settlements API v1
 * 
 * POST /api/v1/settlements - Create a new settlement
 * GET /api/v1/settlements?group_id=xxx - List settlements for a group
 * 
 * Rate Limited: 20 requests per hour for financial operations
 */

import { z } from "zod";
import { NextResponse } from "next/server";
import { 
    createRoute, 
    withAuth, 
    withRateLimit,
    withValidation, 
    withQueryValidation,
    withGroupMembership,
    ApiResponse, 
    ApiError 
} from "@/lib/api";
import { SettlementInputSchema } from "@/lib/validation";
import { withLock, LockKeys } from "@/lib/distributed-lock";
import { logger, SecurityEvents } from "@/lib/logger";
import { invalidateGroupCache, invalidateUserCache } from "@/lib/cache";
import { createRateLimitHeaders } from "@/lib/rate-limit";

const API_VERSION = "v1";

// Query schema for GET
const SettlementsQuerySchema = z.object({
    group_id: z.string().uuid("Invalid group_id parameter"),
});

/**
 * POST /api/v1/settlements
 * Create a new settlement
 */
export const POST = createRoute()
    .use(withAuth())
    .use(withRateLimit("financial"))
    .use(withValidation(SettlementInputSchema))
    .use(withGroupMembership("group_id", { allowBodyGroupId: true }))
    .handler(async (ctx) => {
        const data = ctx.validated;
        const headers = {
            "X-API-Version": API_VERSION,
            ...createRateLimitHeaders(ctx.rateLimit),
        };

        try {
            // Determine from/to users and whether they're placeholders
            const fromUserId = data.from_user || data.from_placeholder_id;
            const toUserId = data.to_user || data.to_placeholder_id;
            const fromIsPlaceholder = !!data.from_placeholder_id;
            const toIsPlaceholder = !!data.to_placeholder_id;

            if (!fromUserId || !toUserId) {
                return ApiError.badRequest("Both from and to users are required");
            }

            // Use distributed lock to prevent double settlements
            const lockKey = LockKeys.settlement(data.group_id, fromUserId, toUserId);

            const result = await withLock(
                lockKey,
                async () => {
                    // Determine if approval is needed
                    const currentUserIsReceiver = toUserId === ctx.user.id;
                    const needsApproval = !toIsPlaceholder && !currentUserIsReceiver && !fromIsPlaceholder;

                    const settlementData: Record<string, unknown> = {
                        group_id: data.group_id,
                        amount: Math.round(data.amount * 100) / 100,
                        status: needsApproval ? "pending" : "approved",
                        requested_by: ctx.user.id,
                        note: data.note || null,
                        ...(needsApproval ? {} : { settled_at: new Date().toISOString() }),
                    };

                    if (fromIsPlaceholder) {
                        settlementData.from_placeholder_id = fromUserId;
                    } else {
                        settlementData.from_user = fromUserId;
                    }

                    if (toIsPlaceholder) {
                        settlementData.to_placeholder_id = toUserId;
                    } else {
                        settlementData.to_user = toUserId;
                    }

                    // Create settlement
                    const { data: settlement, error } = await ctx.supabase
                        .from("settlements")
                        .insert(settlementData)
                        .select()
                        .single();

                    if (error) {
                        throw new Error(error.message);
                    }

                    // Log activity
                    await ctx.supabase.from("activities").insert({
                        user_id: ctx.user.id,
                        group_id: data.group_id,
                        entity_type: "settlement",
                        entity_id: settlement.id,
                        action: needsApproval ? "requested" : "created",
                        metadata: {
                            amount: data.amount,
                            status: needsApproval ? "pending" : "approved",
                        },
                    });

                    return { settlement, needsApproval };
                },
                { ttl: 15 }
            );

            // Invalidate caches
            await Promise.all([
                invalidateGroupCache(data.group_id),
                invalidateUserCache(fromUserId),
                invalidateUserCache(toUserId),
            ]);

            logger.info("Settlement created", {
                settlementId: result.settlement.id,
                groupId: data.group_id,
                amount: data.amount,
                pending: result.needsApproval,
            });

            return NextResponse.json(
                {
                    success: true,
                    data: {
                        id: result.settlement.id,
                        status: result.needsApproval ? "pending" : "approved",
                        amount: result.settlement.amount,
                    },
                    message: result.needsApproval
                        ? "Settlement request sent for approval"
                        : "Settlement recorded successfully",
                },
                { status: 201, headers }
            );

        } catch (error) {
            if (error instanceof Error && error.message.includes("being processed")) {
                return ApiError.conflict("Settlement is being processed. Please wait.");
            }

            logger.error("Settlement creation failed", error instanceof Error ? error : new Error(String(error)));
            return ApiError.internal("Failed to create settlement");
        }
    });

/**
 * GET /api/v1/settlements?group_id=xxx
 * List settlements for a group
 */
export const GET = createRoute()
    .use(withAuth())
    .use(withRateLimit("api"))
    .use(withQueryValidation(SettlementsQuerySchema))
    .use(withGroupMembership("group_id", { allowQueryGroupId: true }))
    .handler(async (ctx) => {
        const headers = {
            "X-API-Version": API_VERSION,
            ...createRateLimitHeaders(ctx.rateLimit),
        };

        try {
            // Fetch settlements
            const { data: settlements, error } = await ctx.supabase
                .from("settlements")
                .select(`
                    *,
                    from_profile:profiles!settlements_from_user_fkey(id, full_name, email),
                    to_profile:profiles!settlements_to_user_fkey(id, full_name, email)
                `)
                .eq("group_id", ctx.groupId)
                .order("created_at", { ascending: false })
                .limit(50);

            if (error) {
                throw error;
            }

            return NextResponse.json(
                {
                    success: true,
                    data: settlements,
                    meta: {
                        count: settlements?.length || 0,
                        group_id: ctx.groupId,
                    },
                },
                { headers }
            );

        } catch (error) {
            logger.error("Failed to fetch settlements", error instanceof Error ? error : new Error(String(error)));
            return ApiError.internal("Failed to fetch settlements");
        }
    });
