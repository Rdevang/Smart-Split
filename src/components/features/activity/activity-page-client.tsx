"use client";

import { useState, useCallback, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActivityFeed } from "./activity-feed";
import { ActivityFilters, type ActivityFiltersState } from "./activity-filters";
import type { ActivityWithDetails } from "@/services/activities.server";

interface Group {
    id: string;
    name: string;
}

interface Member {
    id: string;
    name: string;
}

interface ActivityPageClientProps {
    initialActivities: ActivityWithDetails[];
    initialEncryptedGroupIds: Record<string, string>;
    initialTotalCount: number;
    initialHasMore: boolean;
    groups: Group[];
    members: Member[];
}

const PAGE_SIZE = 20;

export function ActivityPageClient({
    initialActivities,
    initialEncryptedGroupIds,
    initialTotalCount,
    initialHasMore,
    groups,
    members,
}: ActivityPageClientProps) {
    const [activities, setActivities] = useState<ActivityWithDetails[]>(initialActivities);
    const [encryptedGroupIds, setEncryptedGroupIds] = useState<Record<string, string>>(initialEncryptedGroupIds);
    const [totalCount, setTotalCount] = useState(initialTotalCount);
    const [hasMore, setHasMore] = useState(initialHasMore);
    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [filters, setFilters] = useState<ActivityFiltersState>({
        search: "",
        groupId: "",
        memberId: "",
        category: "",
        dateFrom: "",
        dateTo: "",
    });

    // Fetch activities from API
    const fetchActivities = useCallback(
        async (pageNum: number, currentFilters: ActivityFiltersState, append = false, showLoading = true) => {
            if (append) {
                setIsLoadingMore(true);
            } else if (showLoading) {
                setIsLoading(true);
            }

            try {
                const params = new URLSearchParams();
                params.set("page", pageNum.toString());
                params.set("limit", PAGE_SIZE.toString());

                if (currentFilters.search) params.set("search", currentFilters.search);
                if (currentFilters.groupId) params.set("groupId", currentFilters.groupId);
                if (currentFilters.memberId) params.set("memberId", currentFilters.memberId);
                if (currentFilters.category) params.set("category", currentFilters.category);
                if (currentFilters.dateFrom) params.set("dateFrom", currentFilters.dateFrom);
                if (currentFilters.dateTo) params.set("dateTo", currentFilters.dateTo);

                const response = await fetch(`/api/activities?${params.toString()}`);

                if (!response.ok) {
                    throw new Error("Failed to fetch activities");
                }

                const data = await response.json();

                if (append) {
                    setActivities((prev) => [...prev, ...data.activities]);
                    setEncryptedGroupIds((prev) => ({ ...prev, ...data.encryptedGroupIds }));
                } else {
                    setActivities(data.activities);
                    setEncryptedGroupIds(data.encryptedGroupIds);
                }

                setTotalCount(data.totalCount);
                setHasMore(data.hasMore);
                setPage(pageNum);
            } catch (error) {
                console.error("Error fetching activities:", error);
            } finally {
                setIsLoading(false);
                setIsLoadingMore(false);
            }
        },
        []
    );

    // Handle filter changes - reset to page 1
    // Don't show loading spinner for search (keeps focus stable while typing)
    const handleFiltersChange = useCallback(
        (newFilters: ActivityFiltersState) => {
            setFilters((prevFilters) => {
                // Check if only search changed
                const onlySearchChanged =
                    newFilters.groupId === prevFilters.groupId &&
                    newFilters.memberId === prevFilters.memberId &&
                    newFilters.category === prevFilters.category &&
                    newFilters.dateFrom === prevFilters.dateFrom &&
                    newFilters.dateTo === prevFilters.dateTo &&
                    newFilters.search !== prevFilters.search;

                // Don't show loading for search-only changes (keeps typing smooth)
                fetchActivities(1, newFilters, false, !onlySearchChanged);
                return newFilters;
            });
        },
        [fetchActivities]
    );

    // Handle load more
    const handleLoadMore = useCallback(() => {
        if (!isLoadingMore && hasMore) {
            fetchActivities(page + 1, filters, true);
        }
    }, [fetchActivities, page, filters, isLoadingMore, hasMore]);

    // Initial load effect - only when filters change (not on mount, we have SSR data)
    useEffect(() => {
        // Skip initial load if we have data and no filters
        const hasFilters =
            filters.search ||
            filters.groupId ||
            filters.memberId ||
            filters.category ||
            filters.dateFrom ||
            filters.dateTo;

        if (!hasFilters && initialActivities.length > 0) {
            return;
        }
    }, [filters, initialActivities.length]);

    return (
        <div className="space-y-6">
            {/* Filters */}
            <ActivityFilters
                filters={filters}
                onFiltersChange={handleFiltersChange}
                groups={groups}
                members={members}
                isLoading={isLoading}
            />

            {/* Results Count */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    {isLoading ? (
                        "Loading..."
                    ) : (
                        <>
                            Showing {activities.length} of {totalCount} activities
                        </>
                    )}
                </p>
            </div>

            {/* Loading State */}
            {isLoading && activities.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
                </div>
            ) : (
                <>
                    {/* Activity Feed */}
                    <ActivityFeed
                        activities={activities}
                        showGroupName
                        encryptedGroupIds={encryptedGroupIds}
                    />

                    {/* Load More Button */}
                    {hasMore && (
                        <div className="flex justify-center pt-4">
                            <Button
                                variant="outline"
                                onClick={handleLoadMore}
                                disabled={isLoadingMore}
                                className="min-w-[200px]"
                            >
                                {isLoadingMore ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Loading...
                                    </>
                                ) : (
                                    `Show More (${totalCount - activities.length} remaining)`
                                )}
                            </Button>
                        </div>
                    )}

                    {/* End of list message */}
                    {!hasMore && activities.length > 0 && (
                        <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
                            You&apos;ve reached the end of your activity feed
                        </p>
                    )}
                </>
            )}
        </div>
    );
}

