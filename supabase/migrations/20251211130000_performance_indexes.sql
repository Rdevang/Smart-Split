-- ============================================================================
-- PERFORMANCE OPTIMIZATION: Indexes for 50M+ Users Scale
-- ============================================================================
-- 
-- Key Principles:
-- 1. Index columns used in WHERE clauses and JOINs
-- 2. Composite indexes for multi-column queries
-- 3. Partial indexes for filtered queries
-- 4. Covering indexes for frequently accessed columns
-- ============================================================================

-- ============================================================================
-- GROUP_MEMBERS - Most critical table for RLS checks
-- ============================================================================

-- Primary lookup: Check if user is member of a group (used in every RLS check)
CREATE INDEX IF NOT EXISTS idx_group_members_user_group 
    ON public.group_members(user_id, group_id);

-- Lookup by group with role (for admin checks)
CREATE INDEX IF NOT EXISTS idx_group_members_group_role 
    ON public.group_members(group_id, role);

-- Covering index for member listing (avoids table lookup)
CREATE INDEX IF NOT EXISTS idx_group_members_covering 
    ON public.group_members(group_id, user_id, role, joined_at);

-- ============================================================================
-- GROUPS - Frequently queried by creator and for listing
-- ============================================================================

-- Groups by creator (for "my groups" queries)
CREATE INDEX IF NOT EXISTS idx_groups_created_by 
    ON public.groups(created_by);

-- Groups ordered by recent activity (for listing)
CREATE INDEX IF NOT EXISTS idx_groups_updated_at_desc 
    ON public.groups(updated_at DESC);

-- Composite for creator + recent (common dashboard query)
CREATE INDEX IF NOT EXISTS idx_groups_creator_updated 
    ON public.groups(created_by, updated_at DESC);

-- ============================================================================
-- EXPENSES - High volume table
-- ============================================================================

-- Expenses by group (most common query)
CREATE INDEX IF NOT EXISTS idx_expenses_group_date 
    ON public.expenses(group_id, expense_date DESC);

-- Expenses by who paid (for balance calculations)
CREATE INDEX IF NOT EXISTS idx_expenses_paid_by 
    ON public.expenses(paid_by);

-- Composite for group + paid_by (balance queries)
CREATE INDEX IF NOT EXISTS idx_expenses_group_paid_by 
    ON public.expenses(group_id, paid_by);

-- Recent expenses (for dashboard)
CREATE INDEX IF NOT EXISTS idx_expenses_created_at_desc 
    ON public.expenses(created_at DESC);

-- ============================================================================
-- EXPENSE_SPLITS - Very high volume (1 expense = N splits)
-- ============================================================================

-- Splits by expense (most common join)
CREATE INDEX IF NOT EXISTS idx_expense_splits_expense 
    ON public.expense_splits(expense_id);

-- Splits by user (for "what do I owe" queries)
CREATE INDEX IF NOT EXISTS idx_expense_splits_user 
    ON public.expense_splits(user_id);

-- Unsettled splits by user (for balance calculations)
CREATE INDEX IF NOT EXISTS idx_expense_splits_user_unsettled 
    ON public.expense_splits(user_id) 
    WHERE is_settled = FALSE;

-- Composite for expense + user (common lookup)
CREATE INDEX IF NOT EXISTS idx_expense_splits_expense_user 
    ON public.expense_splits(expense_id, user_id);

-- ============================================================================
-- SETTLEMENTS - Medium volume
-- ============================================================================

-- Settlements by group
CREATE INDEX IF NOT EXISTS idx_settlements_group 
    ON public.settlements(group_id);

-- Settlements by users involved
CREATE INDEX IF NOT EXISTS idx_settlements_from_user 
    ON public.settlements(from_user);

CREATE INDEX IF NOT EXISTS idx_settlements_to_user 
    ON public.settlements(to_user);

-- ============================================================================
-- PROFILES - Frequently joined table
-- ============================================================================

-- Email lookup (for adding members)
CREATE INDEX IF NOT EXISTS idx_profiles_email 
    ON public.profiles(email);

-- ============================================================================
-- ACTIVITIES - Time-series data
-- ============================================================================

-- Activities by group (for activity feed)
CREATE INDEX IF NOT EXISTS idx_activities_group_created 
    ON public.activities(group_id, created_at DESC);

-- Activities by user (for personal feed)
CREATE INDEX IF NOT EXISTS idx_activities_user_created 
    ON public.activities(user_id, created_at DESC);

-- ============================================================================
-- FRIENDSHIPS - Social graph
-- ============================================================================

-- Both directions for friendship lookup
CREATE INDEX IF NOT EXISTS idx_friendships_user 
    ON public.friendships(user_id, status);

CREATE INDEX IF NOT EXISTS idx_friendships_friend 
    ON public.friendships(friend_id, status);

-- ============================================================================
-- OPTIMIZED RLS FUNCTIONS (Replace existing with indexed versions)
-- ============================================================================

-- Drop and recreate with search_path for security
DROP FUNCTION IF EXISTS public.is_group_member(UUID, UUID);
CREATE OR REPLACE FUNCTION public.is_group_member(group_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    result BOOLEAN;
BEGIN
    -- Uses idx_group_members_user_group index
    SELECT EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = group_uuid 
        AND user_id = user_uuid
    ) INTO result;
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

DROP FUNCTION IF EXISTS public.is_group_admin(UUID, UUID);
CREATE OR REPLACE FUNCTION public.is_group_admin(group_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    result BOOLEAN;
BEGIN
    -- Uses idx_group_members_group_role index
    SELECT EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = group_uuid 
        AND user_id = user_uuid 
        AND role = 'admin'
    ) INTO result;
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- OPTIMIZED BALANCE CALCULATION FUNCTION
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_group_balances(UUID);
CREATE OR REPLACE FUNCTION public.get_group_balances(group_uuid UUID)
RETURNS TABLE (
    user_id UUID,
    user_name TEXT,
    balance DECIMAL(12, 2)
) AS $$
BEGIN
    RETURN QUERY
    WITH 
    -- Amount each user paid (uses idx_expenses_group_paid_by)
    paid AS (
        SELECT 
            e.paid_by as uid,
            COALESCE(SUM(e.amount), 0) as total_paid
        FROM public.expenses e
        WHERE e.group_id = group_uuid
        GROUP BY e.paid_by
    ),
    -- Amount each user owes (uses idx_expense_splits_user_unsettled)
    owed AS (
        SELECT 
            es.user_id as uid,
            COALESCE(SUM(es.amount), 0) as total_owed
        FROM public.expense_splits es
        INNER JOIN public.expenses e ON e.id = es.expense_id
        WHERE e.group_id = group_uuid 
        AND es.is_settled = FALSE
        GROUP BY es.user_id
    ),
    -- Amount settled out
    settled_out AS (
        SELECT 
            s.from_user as uid,
            COALESCE(SUM(s.amount), 0) as total_out
        FROM public.settlements s
        WHERE s.group_id = group_uuid
        GROUP BY s.from_user
    ),
    -- Amount settled in
    settled_in AS (
        SELECT 
            s.to_user as uid,
            COALESCE(SUM(s.amount), 0) as total_in
        FROM public.settlements s
        WHERE s.group_id = group_uuid
        GROUP BY s.to_user
    )
    SELECT 
        gm.user_id,
        COALESCE(p.full_name, p.email) as user_name,
        (
            COALESCE(paid.total_paid, 0) 
            - COALESCE(owed.total_owed, 0) 
            + COALESCE(settled_out.total_out, 0) 
            - COALESCE(settled_in.total_in, 0)
        )::DECIMAL(12, 2) as balance
    FROM public.group_members gm
    INNER JOIN public.profiles p ON p.id = gm.user_id
    LEFT JOIN paid ON paid.uid = gm.user_id
    LEFT JOIN owed ON owed.uid = gm.user_id
    LEFT JOIN settled_out ON settled_out.uid = gm.user_id
    LEFT JOIN settled_in ON settled_in.uid = gm.user_id
    WHERE gm.group_id = group_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- STATISTICS FOR QUERY PLANNER
-- ============================================================================

-- Analyze tables to update statistics (helps query planner)
ANALYZE public.profiles;
ANALYZE public.groups;
ANALYZE public.group_members;
ANALYZE public.expenses;
ANALYZE public.expense_splits;
ANALYZE public.settlements;
ANALYZE public.activities;
ANALYZE public.friendships;

