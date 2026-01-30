import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptUrlId } from "@/lib/url-ids";
import { ApiResponse, ApiError, withErrorHandler } from "@/lib/api-responses";

export const dynamic = "force-dynamic";

interface ActivityFilters {
    groupId?: string;
    memberId?: string;
    category?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
}

/**
 * GET /api/activities
 * 
 * Fetches paginated activities with optional filters and search
 * 
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20)
 * - groupId: Filter by group
 * - memberId: Filter by member who performed action
 * - category: Filter by entity_type (expense, settlement, member, group)
 * - dateFrom: Filter from date (ISO string)
 * - dateTo: Filter to date (ISO string)
 * - search: Search in description/metadata
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
        return ApiError.unauthorized();
    }

    const userId = session.user.id;
    const searchParams = request.nextUrl.searchParams;

    // Pagination
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50); // Max 50
    const offset = (page - 1) * limit;

    // Filters
    const filters: ActivityFilters = {
        groupId: searchParams.get("groupId") || undefined,
        memberId: searchParams.get("memberId") || undefined,
        category: searchParams.get("category") || undefined,
        dateFrom: searchParams.get("dateFrom") || undefined,
        dateTo: searchParams.get("dateTo") || undefined,
        search: searchParams.get("search") || undefined,
    };

    // Get user's group IDs first (for authorization)
    const { data: memberships } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", userId);

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
    let query = supabase
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
    if (filters.groupId) {
        if (!userGroupIds.includes(filters.groupId)) {
            return ApiError.notFound("Group");
        }
        query = query.eq("group_id", filters.groupId);
    } else {
        // Only show activities from user's groups
        query = query.in("group_id", userGroupIds);
    }

    // Filter by member
    if (filters.memberId) {
        query = query.eq("user_id", filters.memberId);
    }

    // Filter by category (entity_type)
    if (filters.category) {
        query = query.eq("entity_type", filters.category);
    }

    // Filter by date range
    if (filters.dateFrom) {
        query = query.gte("created_at", filters.dateFrom);
    }
    if (filters.dateTo) {
        // Add one day to include the full end date
        const endDate = new Date(filters.dateTo);
        endDate.setDate(endDate.getDate() + 1);
        query = query.lt("created_at", endDate.toISOString());
    }

    // Search in metadata (description, amount, etc.)
    if (filters.search && filters.search.trim()) {
        const searchTerm = filters.search.trim().toLowerCase();
        // Search in metadata->description using PostgreSQL JSONB
        query = query.or(`metadata->>description.ilike.%${searchTerm}%,metadata->>member_name.ilike.%${searchTerm}%`);
    }

    // Order and paginate
    query = query
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

    const { data: activities, error, count } = await query;

    if (error) {
        console.error("Error fetching activities:", error);
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
