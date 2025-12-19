-- ============================================
-- STEP 1: Add new status values to the enum
-- Run this FIRST, then commit
-- ============================================
ALTER TYPE public.feedback_status ADD VALUE IF NOT EXISTS 'submitted';
ALTER TYPE public.feedback_status ADD VALUE IF NOT EXISTS 'under_review';
ALTER TYPE public.feedback_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE public.feedback_status ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE public.feedback_status ADD VALUE IF NOT EXISTS 'closed';

-- Fix the SELECT policy to not reference auth.users (which causes permission errors)
DROP POLICY IF EXISTS "Users can view own feedback" ON public.feedback;

CREATE POLICY "Users can view own feedback"
    ON public.feedback FOR SELECT
    USING (user_id = auth.uid());

-- Allow authenticated users to view feedback by their email too
DROP POLICY IF EXISTS "Users can view feedback by email" ON public.feedback;

CREATE POLICY "Users can view feedback by email"
    ON public.feedback FOR SELECT
    USING (
        auth.uid() IS NOT NULL AND
        email = (SELECT email FROM public.profiles WHERE id = auth.uid())
    );
