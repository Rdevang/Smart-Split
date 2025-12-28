/**
 * Cached version of expenses server service
 * 
 * CACHING STRATEGY:
 * - Redis (via cached()): For expensive queries with automatic compression
 * - Tag-based invalidation via revalidateTag() in actions.ts
 * 
 * NOTE: We cannot use unstable_cache() here because it cannot contain
 * dynamic functions like cookies() which Supabase server client requires.
 */

import { cached, cachedCoalesced, CacheKeys, CacheTTL } from "@/lib/cache";
import {
    expensesServerService,
    type ExpenseWithDetails,
    type PaginatedResult,
    type PaginationParams,
    type ExpenseSummary,
} from "./expenses.server";

export const expensesCachedServerService = {
    /**
     * Get expenses for a group (cached for 5 minutes)
     * Uses REQUEST COALESCING - high traffic endpoint
     * Only caches first page - pagination variants too numerous to cache
     */
    async getExpenses(
        groupId: string,
        params: PaginationParams = {}
    ): Promise<PaginatedResult<ExpenseWithDetails>> {
        // Only cache first page (most common request)
        if (params.page && params.page > 1) {
            return expensesServerService.getExpenses(groupId, params);
        }

        const cacheKey = `group:${groupId}:expenses:page1`;
        return cachedCoalesced(
            cacheKey,
            () => expensesServerService.getExpenses(groupId, params),
            CacheTTL.MEDIUM // 5 minutes
        );
    },

    /**
     * Get user's expenses across all groups (cached for 5 minutes)
     */
    async getUserExpenses(
        userId: string,
        params: PaginationParams = {}
    ): Promise<PaginatedResult<ExpenseWithDetails>> {
        if (params.page && params.page > 1) {
            return expensesServerService.getUserExpenses(userId, params);
        }

        const cacheKey = `user:${userId}:expenses:page1`;
        return cached(
            cacheKey,
            () => expensesServerService.getUserExpenses(userId, params),
            CacheTTL.MEDIUM // 5 minutes
        );
    },

    /**
     * Get user expense summary (cached for 5 minutes)
     * Uses REQUEST COALESCING - dashboard aggregate, high traffic
     * This aggregates across all groups - moderately expensive
     */
    async getUserExpenseSummary(userId: string): Promise<ExpenseSummary> {
        const cacheKey = CacheKeys.userDashboard(userId);
        return cachedCoalesced(
            cacheKey,
            () => expensesServerService.getUserExpenseSummary(userId),
            CacheTTL.MEDIUM // 5 minutes
        );
    },

    /**
     * Get single expense (NOT cached - usually accessed for edit/delete)
     */
    async getExpense(expenseId: string): Promise<ExpenseWithDetails | null> {
        return expensesServerService.getExpense(expenseId);
    },

    /**
     * Get expense count for a group (cached for 5 minutes)
     */
    async getGroupExpenseCount(groupId: string): Promise<number> {
        const cacheKey = `group:${groupId}:expense_count`;
        return cached(
            cacheKey,
            () => expensesServerService.getGroupExpenseCount(groupId),
            CacheTTL.MEDIUM // 5 minutes
        );
    },

    /**
     * Get recent expenses for dashboard (cached for 5 minutes)
     * Key part of dashboard - caching helps a lot here
     */
    async getRecentExpenses(
        userId: string,
        limit: number = 5
    ): Promise<ExpenseWithDetails[]> {
        const cacheKey = `user:${userId}:recent_expenses:${limit}`;
        return cached(
            cacheKey,
            () => expensesServerService.getRecentExpenses(userId, limit),
            CacheTTL.MEDIUM // 5 minutes
        );
    },
};

// Re-export types
export type {
    ExpenseWithDetails,
    PaginatedResult,
    PaginationParams,
    ExpenseSummary,
    SplitWithParticipant,
    PlaceholderMember,
} from "./expenses.server";
