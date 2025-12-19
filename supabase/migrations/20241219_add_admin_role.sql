-- ============================================
-- Add admin role to profiles
-- ============================================

-- Create role enum type
DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('user', 'admin', 'site_admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add role column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role public.user_role DEFAULT 'user';

-- Create index for faster role queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- ============================================
-- Assign site_admin role to specific user
-- ============================================

-- Update the user with email rdevang170@gmail.com to site_admin
UPDATE public.profiles 
SET role = 'site_admin' 
WHERE id = (
    SELECT id FROM auth.users WHERE email = 'rdevang170@gmail.com'
);

-- ============================================
-- RLS Policies for admin access
-- ============================================

-- Policy: Site admins can view all feedback
CREATE POLICY "Site admins can view all feedback"
    ON public.feedback FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'site_admin')
        )
    );

-- Policy: Site admins can update feedback status
CREATE POLICY "Admins can update feedback"
    ON public.feedback FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'site_admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'site_admin')
        )
    );

-- ============================================
-- Helper function to check admin status
-- ============================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'site_admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_site_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role = 'site_admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
