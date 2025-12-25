-- Consolidate multiple permissive RLS policies for better performance
-- Multiple permissive policies on the same table/action cause performance issues
-- as each policy must be evaluated for every query

-- ============================================
-- EMAIL_LOGS TABLE - Consolidate SELECT policies
-- ============================================

-- Drop existing overlapping policies
DROP POLICY IF EXISTS "Service role can modify email logs" ON public.email_logs;
DROP POLICY IF EXISTS "Users and service can view email logs" ON public.email_logs;
DROP POLICY IF EXISTS "Service role can manage email logs" ON public.email_logs;
DROP POLICY IF EXISTS "Users can view own email logs" ON public.email_logs;

-- Create single consolidated SELECT policy
-- Combines: service role access + user own logs access
CREATE POLICY "email_logs_select_policy" ON public.email_logs
    FOR SELECT
    USING (
        -- Service role can see all
        (select auth.role()) = 'service_role'
        OR
        -- Users can see their own email logs
        to_user_id = (select auth.uid())
    );

-- Create single INSERT policy for service role
CREATE POLICY "email_logs_insert_policy" ON public.email_logs
    FOR INSERT
    WITH CHECK ((select auth.role()) = 'service_role');

-- Create single UPDATE policy for service role
CREATE POLICY "email_logs_update_policy" ON public.email_logs
    FOR UPDATE
    USING ((select auth.role()) = 'service_role')
    WITH CHECK ((select auth.role()) = 'service_role');

-- Create single DELETE policy for service role
CREATE POLICY "email_logs_delete_policy" ON public.email_logs
    FOR DELETE
    USING ((select auth.role()) = 'service_role');

-- ============================================
-- REVIEWS TABLE - Consolidate policies
-- ============================================

-- Drop existing overlapping policies
DROP POLICY IF EXISTS "Admins can manage all reviews" ON public.reviews;
DROP POLICY IF EXISTS "Anyone can view approved reviews" ON public.reviews;
DROP POLICY IF EXISTS "Authenticated users can submit reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can update own pending reviews" ON public.reviews;

-- Create single consolidated SELECT policy
-- Combines: anyone can view approved + admins can view all
CREATE POLICY "reviews_select_policy" ON public.reviews
    FOR SELECT
    USING (
        -- Anyone can view approved reviews with rating >= 4
        (is_approved = true AND rating >= 4)
        OR
        -- Admins (admin or site_admin) can view all reviews
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = (select auth.uid())
            AND role IN ('admin', 'site_admin')
        )
    );

-- Create single INSERT policy
-- Authenticated users can submit reviews
CREATE POLICY "reviews_insert_policy" ON public.reviews
    FOR INSERT
    WITH CHECK ((select auth.role()) = 'authenticated');

-- Create single UPDATE policy
-- Combines: admins can update all + users can update own pending
CREATE POLICY "reviews_update_policy" ON public.reviews
    FOR UPDATE
    USING (
        -- Admins can update any review
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = (select auth.uid())
            AND role IN ('admin', 'site_admin')
        )
        OR
        -- Users can update their own pending reviews (using user_id)
        (
            user_id = (select auth.uid())
            AND is_approved = false
        )
    )
    WITH CHECK (
        -- Admins can update to any state
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = (select auth.uid())
            AND role IN ('admin', 'site_admin')
        )
        OR
        -- Users can only update their own pending reviews
        (
            user_id = (select auth.uid())
            AND is_approved = false
        )
    );

-- Create single DELETE policy for admins only
CREATE POLICY "reviews_delete_policy" ON public.reviews
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = (select auth.uid())
            AND role IN ('admin', 'site_admin')
        )
    );

-- Add comments for documentation
COMMENT ON POLICY "email_logs_select_policy" ON public.email_logs IS 'Service role sees all, users see own logs';
COMMENT ON POLICY "reviews_select_policy" ON public.reviews IS 'Anyone sees approved reviews, admins see all';
COMMENT ON POLICY "reviews_update_policy" ON public.reviews IS 'Admins can update all, users can update own pending';

