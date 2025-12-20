-- Fix RLS Performance Issues
-- 1. Wrap auth.uid() in (select auth.uid()) to avoid re-evaluation per row
-- 2. Consolidate multiple permissive policies into single policies
-- 3. Remove duplicate indexes

-- =====================================================
-- 1. FIX security_events TABLE
-- =====================================================
DROP POLICY IF EXISTS "Users can view own security events" ON public.security_events;

CREATE POLICY "Users can view own security events"
    ON public.security_events FOR SELECT
    USING (user_id = (SELECT auth.uid()));

-- =====================================================
-- 2. FIX feedback TABLE - Consolidate policies
-- =====================================================

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users can view feedback by email" ON public.feedback;
DROP POLICY IF EXISTS "Site admins can view all feedback" ON public.feedback;
DROP POLICY IF EXISTS "Admins can update feedback" ON public.feedback;

-- Create single optimized SELECT policy combining all conditions
CREATE POLICY "Users can view feedback"
    ON public.feedback FOR SELECT
    USING (
        -- User owns the feedback
        user_id = (SELECT auth.uid())
        -- OR email matches user's email (for anonymous submissions)
        OR email = (SELECT email FROM public.profiles WHERE id = (SELECT auth.uid()))
        -- OR user is site admin
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = (SELECT auth.uid()) 
            AND role IN ('admin', 'site_admin')
        )
    );

-- Create optimized UPDATE policy for admins
CREATE POLICY "Admins can update feedback"
    ON public.feedback FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = (SELECT auth.uid()) 
            AND role IN ('admin', 'site_admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = (SELECT auth.uid()) 
            AND role IN ('admin', 'site_admin')
        )
    );

-- =====================================================
-- 3. FIX DUPLICATE INDEXES on expenses table
-- =====================================================

-- Keep idx_expenses_created_at (from original schema)
-- Drop the duplicate idx_expenses_created_at_desc
DROP INDEX IF EXISTS idx_expenses_created_at_desc;

-- Verify we still have the correct index
-- CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at DESC);

-- =====================================================
-- 4. ANALYZE tables to update statistics
-- =====================================================
ANALYZE public.security_events;
ANALYZE public.feedback;
ANALYZE public.expenses;

