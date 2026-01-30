/**
 * GET /api/activities
 * 
 * Fetches paginated activities with optional filters and search
 * 
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 50)
 * - groupId: Filter by group
 * - memberId: Filter by member who performed action
 * - category: Filter by entity_type (expense, settlement, member, group)
 * - dateFrom: Filter from date (ISO string)
 * - dateTo: Filter to date (ISO string)
 * - search: Search in description/metadata
 */

import { z } from "zod";
import { createRoute, withAuth, withQueryValidation, ApiResponse, ApiError, type AuthContext, type QueryValidatedContext } from "@/lib/api";
import { encryptUrlId } from "@/lib/url-ids";
import { apiLog } from "@/lib/console-logger";

export const dynamic = "force-dynamic";

// Query validation schema
const ActivityQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).default(20).transform(v => Math.min(v, 50)), // Cap at 50
    groupId: z.string().uuid().optional(),
    memberId: z.string().uuid().optional(),
    category: z.enum(["expense", "settlement", "member", "group"]).optional(),
    dateFrom: z.string().optional(), // Accept any string, validated later
    dateTo: z.string().optional(),   // Accept any string, validated later
    search: z.string().optional(),
});

type ActivityQuery = z.infer<typeof ActivityQuerySchema>;
type ActivityContext = AuthContext & QueryValidatedContext<ActivityQuery>;

export const GET = createRoute()
    .use(withAuth())
    .use(withQueryValidation(ActivityQuerySchema))
    .handler(async (ctx) => {
        // Type assertion for accumulated context
        const { user, query, supabase } = ctx as unknown as ActivityContext;
        const { page, limit, groupId, memberId, category, dateFrom, dateTo, search } = query;
        const offset = (page - 1) * limit;

        // Get user's group IDs first (for authorization)
        const { data: memberships } = await supabase
            .from("group_members")
            .select("group_id")
            .eq("user_id", user.id);

        if (!memberships || memberships.length === 0) {
            return ApiResponse.success({
                activities: [],
                totalCount: 0,
                page,
                limit,
                hasMore: false,
                encryptedGroupIds: {},
            });
        }

        const userGroupIds = memberships.map((m) => m.group_id);

        // Build query
        let dbQuery = supabase
            .from("activities")
            .select(`
                *,
                user_profile:profiles!activities_user_id_fkey (
                    id,
                    full_name,
                    avatar_url
                ),
                group:groups (
                    id,
                    name
                )
            `, { count: "exact" });

        // If filtering by specific group, check authorization
        if (groupId) {
            if (!userGroupIds.includes(groupId)) {
                return ApiError.notFound("Group");
            }
            dbQuery = dbQuery.eq("group_id", groupId);
        } else {
            // Only show activities from user's groups
            dbQuery = dbQuery.in("group_id", userGroupIds);
        }

        // Filter by member
        if (memberId) {
            dbQuery = dbQuery.eq("user_id", memberId);
        }

        // Filter by category (entity_type)
        if (category) {
            dbQuery = dbQuery.eq("entity_type", category);
        }

        // Filter by date range
        if (dateFrom) {
            dbQuery = dbQuery.gte("created_at", dateFrom);
        }
        if (dateTo) {
            // Add one day to include the full end date
            const endDate = new Date(dateTo);
            endDate.setDate(endDate.getDate() + 1);
            dbQuery = dbQuery.lt("created_at", endDate.toISOString());
        }

        // Search in metadata
        if (search && search.trim()) {
            const searchTerm = search.trim().toLowerCase();
            dbQuery = dbQuery.or(`metadata->>description.ilike.%${searchTerm}%,metadata->>member_name.ilike.%${searchTerm}%`);
        }

        // Order and paginate
        dbQuery = dbQuery
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);

        const { data: activities, error, count } = await dbQuery;

        if (error) {
            apiLog.error("Failed to fetch activities", error);
            return ApiError.internal("Failed to fetch activities");
        }

        // Pre-encrypt group IDs
        const encryptedGroupIds: Record<string, string> = {};
        (activities || []).forEach((activity) => {
            const group = activity.group as { id: string; name: string } | null;
            if (group?.id && !encryptedGroupIds[group.id]) {
                encryptedGroupIds[group.id] = encryptUrlId(group.id);
            }
        });

        // Transform activities
        const transformedActivities = (activities || []).map((activity) => ({
            ...activity,
            user_profile: activity.user_profile as {
                id: string;
                full_name: string | null;
                avatar_url: string | null;
            } | null,
            group: activity.group as { id: string; name: string } | null,
        }));

        const totalCount = count || 0;
        const hasMore = offset + (activities?.length || 0) < totalCount;

        return ApiResponse.success({
            activities: transformedActivities,
            totalCount,
            page,
            limit,
            hasMore,
            encryptedGroupIds,
        });
    });
