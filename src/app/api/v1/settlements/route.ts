/**
 * Settlements API v1
 * 
 * POST /api/v1/settlements - Create a new settlement
 * GET /api/v1/settlements?group_id=xxx - List settlements for a group
 * 
 * Rate Limited: 20 requests per hour for financial operations
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { ValidationSchemas, SettlementInputSchema, createValidator } from "@/lib/validation";
import { withLock, LockKeys } from "@/lib/distributed-lock";
import { logger, SecurityEvents } from "@/lib/logger";
import { invalidateGroupCache, invalidateUserCache } from "@/lib/cache";

const API_VERSION = "v1";

// Type for rate limit headers
interface RateLimitHeadersInput {
    limit: number;
    remaining: number;
    reset: number;
    retryAfter?: number;
}

// Reusable headers for API responses
function createApiHeaders(rateLimitResult?: RateLimitHeadersInput): HeadersInit {
    const headers: HeadersInit = {
        "X-API-Version": API_VERSION,
        "Content-Type": "application/json",
    };

    if (rateLimitResult) {
        return {
            ...headers,
            "X-RateLimit-Limit": rateLimitResult.limit.toString(),
            "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
            "X-RateLimit-Reset": rateLimitResult.reset.toString(),
            ...(rateLimitResult.retryAfter && { "Retry-After": rateLimitResult.retryAfter.toString() }),
        };
    }

    return headers;
}

/**
 * POST /api/v1/settlements
 * Create a new settlement
 */
export async function POST(request: NextRequest) {
    const ip = getClientIP(request);

    // Rate limit check for financial operations
    const rateLimitResult = await checkRateLimit(ip, "financial");

    if (!rateLimitResult.success) {
        logger.security(
            SecurityEvents.RATE_LIMIT_EXCEEDED,
            "medium",
            "blocked",
            { ip, endpoint: "/api/v1/settlements", type: "financial" }
        );

        return NextResponse.json(
            {
                error: "Rate limit exceeded",
                message: `Too many settlement requests. Please try again in ${rateLimitResult.retryAfter} seconds.`,
                retryAfter: rateLimitResult.retryAfter,
            },
            {
                status: 429,
                headers: createApiHeaders(rateLimitResult),
            }
        );
    }

    try {
        // Parse and validate request body
        const body = await request.json();
        const validation = SettlementInputSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                {
                    error: "Validation failed",
                    details: validation.error.issues.map(e => ({
                        field: e.path.join("."),
                        message: e.message,
                    })),
                },
                { status: 400, headers: createApiHeaders(rateLimitResult) }
            );
        }

        const data = validation.data;

        // Authenticate user
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: "Authentication required" },
                { status: 401, headers: createApiHeaders(rateLimitResult) }
            );
        }

        // Verify user is a member of the group
        const { data: membership } = await supabase
            .from("group_members")
            .select("id")
            .eq("group_id", data.group_id)
            .eq("user_id", user.id)
            .single();

        if (!membership) {
            logger.security(
                SecurityEvents.ACCESS_DENIED,
                "medium",
                "blocked",
                { userId: user.id, groupId: data.group_id, action: "create_settlement" }
            );

            return NextResponse.json(
                { error: "Not authorized to create settlements in this group" },
                { status: 403, headers: createApiHeaders(rateLimitResult) }
            );
        }

        // Determine from/to users and whether they're placeholders
        const fromUserId = data.from_user || data.from_placeholder_id;
        const toUserId = data.to_user || data.to_placeholder_id;
        const fromIsPlaceholder = !!data.from_placeholder_id;
        const toIsPlaceholder = !!data.to_placeholder_id;

        if (!fromUserId || !toUserId) {
            return NextResponse.json(
                { error: "Both from and to users are required" },
                { status: 400, headers: createApiHeaders(rateLimitResult) }
            );
        }

        // Use distributed lock to prevent double settlements
        const lockKey = LockKeys.settlement(data.group_id, fromUserId, toUserId);

        const result = await withLock(
            lockKey,
            async () => {
                // Determine if approval is needed
                const currentUserIsReceiver = toUserId === user.id;
                const needsApproval = !toIsPlaceholder && !currentUserIsReceiver && !fromIsPlaceholder;

                const settlementData: Record<string, unknown> = {
                    group_id: data.group_id,
                    amount: Math.round(data.amount * 100) / 100,
                    status: needsApproval ? "pending" : "approved",
                    requested_by: user.id,
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
                const { data: settlement, error } = await supabase
                    .from("settlements")
                    .insert(settlementData)
                    .select()
                    .single();

                if (error) {
                    throw new Error(error.message);
                }

                // Log activity
                await supabase.from("activities").insert({
                    user_id: user.id,
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
            { status: 201, headers: createApiHeaders(rateLimitResult) }
        );

    } catch (error) {
        if (error instanceof Error && error.message.includes("being processed")) {
            return NextResponse.json(
                { error: "Settlement is being processed. Please wait." },
                { status: 409, headers: createApiHeaders(rateLimitResult) }
            );
        }

        logger.error("Settlement creation failed", error instanceof Error ? error : new Error(String(error)));

        return NextResponse.json(
            { error: "Failed to create settlement" },
            { status: 500, headers: createApiHeaders(rateLimitResult) }
        );
    }
}

/**
 * GET /api/v1/settlements?group_id=xxx
 * List settlements for a group
 */
export async function GET(request: NextRequest) {
    const ip = getClientIP(request);

    // Rate limit check (general API)
    const rateLimitResult = await checkRateLimit(ip, "api");

    if (!rateLimitResult.success) {
        return NextResponse.json(
            { error: "Rate limit exceeded" },
            { status: 429, headers: createApiHeaders(rateLimitResult) }
        );
    }

    try {
        const { searchParams } = new URL(request.url);
        const groupId = searchParams.get("group_id");

        // Validate group ID
        const groupIdValidation = ValidationSchemas.uuid.safeParse(groupId);
        if (!groupIdValidation.success) {
            return NextResponse.json(
                { error: "Invalid group_id parameter" },
                { status: 400, headers: createApiHeaders(rateLimitResult) }
            );
        }

        // Authenticate
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: "Authentication required" },
                { status: 401, headers: createApiHeaders(rateLimitResult) }
            );
        }

        // Verify membership
        const { data: membership } = await supabase
            .from("group_members")
            .select("id")
            .eq("group_id", groupIdValidation.data)
            .eq("user_id", user.id)
            .single();

        if (!membership) {
            return NextResponse.json(
                { error: "Not authorized to view settlements in this group" },
                { status: 403, headers: createApiHeaders(rateLimitResult) }
            );
        }

        // Fetch settlements
        const { data: settlements, error } = await supabase
            .from("settlements")
            .select(`
                *,
                from_profile:profiles!settlements_from_user_fkey(id, full_name, email),
                to_profile:profiles!settlements_to_user_fkey(id, full_name, email)
            `)
            .eq("group_id", groupIdValidation.data)
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
                    group_id: groupIdValidation.data,
                },
            },
            { headers: createApiHeaders(rateLimitResult) }
        );

    } catch (error) {
        logger.error("Failed to fetch settlements", error instanceof Error ? error : new Error(String(error)));

        return NextResponse.json(
            { error: "Failed to fetch settlements" },
            { status: 500, headers: createApiHeaders(rateLimitResult) }
        );
    }
}

