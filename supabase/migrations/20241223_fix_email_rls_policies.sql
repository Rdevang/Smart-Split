-- ============================================================================
-- FIX RLS POLICIES FOR EMAIL TABLES
-- 1. Use (select auth.function()) instead of auth.function() for performance
-- 2. Combine multiple permissive policies into one
-- ============================================================================

-- 1. Fix email_queue policies
-- ============================================================================
DROP POLICY IF EXISTS "Service role can manage email queue" ON public.email_queue;

-- Service role policy - use (select) pattern
CREATE POLICY "Service role can manage email queue"
    ON public.email_queue FOR ALL
    USING ((select auth.role()) = 'service_role');

-- 2. Fix email_logs policies
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own email logs" ON public.email_logs;
DROP POLICY IF EXISTS "Service role can manage email logs" ON public.email_logs;

-- Combined SELECT policy: users see own logs OR service_role sees all
CREATE POLICY "Users and service can view email logs"
    ON public.email_logs FOR SELECT
    USING (
        to_user_id = (select auth.uid())
        OR (select auth.role()) = 'service_role'
    );

-- Service role INSERT/UPDATE/DELETE
CREATE POLICY "Service role can modify email logs"
    ON public.email_logs FOR ALL
    USING ((select auth.role()) = 'service_role')
    WITH CHECK ((select auth.role()) = 'service_role');

