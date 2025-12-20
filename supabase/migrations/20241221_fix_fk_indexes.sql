-- Fix Unindexed Foreign Keys
-- These are actual performance issues that need to be addressed

-- =====================================================
-- 1. Add index for blocked_ips.blocked_by FK
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_blocked_ips_blocked_by 
    ON public.blocked_ips(blocked_by);

-- =====================================================
-- 2. Add index for settlements.requested_by FK
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_settlements_requested_by 
    ON public.settlements(requested_by);

-- =====================================================
-- NOTE: About "Unused Index" warnings
-- =====================================================
-- The linter reports many indexes as "unused" because:
-- 1. The app is new with minimal traffic
-- 2. Supabase tracks index usage statistics from actual queries
-- 3. These indexes WILL be used as the app scales
--
-- DO NOT DROP these indexes:
-- - idx_profiles_email (needed for email lookups)
-- - idx_profiles_role (needed for admin queries)
-- - idx_groups_invite_code (needed for group joins)
-- - idx_expenses_created_at (needed for sorting)
-- - idx_notifications_user_read (needed for unread counts)
-- - idx_group_members_* (needed for membership queries)
-- - idx_activities_* (needed for activity feeds)
-- - idx_feedback_* (needed for admin feedback views)
-- etc.
--
-- These indexes are pre-emptive optimizations that prevent
-- table scans as your data grows. Removing them now would
-- cause performance issues later when you have real traffic.
-- =====================================================

-- Update statistics
ANALYZE public.blocked_ips;
ANALYZE public.settlements;

