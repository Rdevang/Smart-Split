-- ============================================
-- RATE LIMIT SETTINGS TABLE
-- ============================================
-- Allows site admins to enable/disable rate limiting on specific routes

CREATE TABLE IF NOT EXISTS public.rate_limit_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_pattern TEXT NOT NULL UNIQUE,
    route_name TEXT NOT NULL,
    description TEXT,
    rate_limit_type TEXT NOT NULL DEFAULT 'api',
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    requests_limit INTEGER NOT NULL DEFAULT 100,
    window_duration TEXT NOT NULL DEFAULT '1 m',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES public.profiles(id)
);

-- Add index for quick lookups
CREATE INDEX IF NOT EXISTS idx_rate_limit_settings_pattern ON public.rate_limit_settings(route_pattern);
CREATE INDEX IF NOT EXISTS idx_rate_limit_settings_enabled ON public.rate_limit_settings(is_enabled);

-- Enable RLS
ALTER TABLE public.rate_limit_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only site_admin can manage rate limit settings
CREATE POLICY "Site admins can view rate limit settings"
    ON public.rate_limit_settings FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = (SELECT auth.uid()) 
            AND role = 'site_admin'
        )
    );

CREATE POLICY "Site admins can update rate limit settings"
    ON public.rate_limit_settings FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = (SELECT auth.uid()) 
            AND role = 'site_admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = (SELECT auth.uid()) 
            AND role = 'site_admin'
        )
    );

CREATE POLICY "Site admins can insert rate limit settings"
    ON public.rate_limit_settings FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = (SELECT auth.uid()) 
            AND role = 'site_admin'
        )
    );

CREATE POLICY "Site admins can delete rate limit settings"
    ON public.rate_limit_settings FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = (SELECT auth.uid()) 
            AND role = 'site_admin'
        )
    );

-- Insert default rate limit settings for all routes
INSERT INTO public.rate_limit_settings (route_pattern, route_name, description, rate_limit_type, is_enabled, requests_limit, window_duration) VALUES
    -- Auth routes
    ('/login', 'Login Page', 'User login page', 'auth', false, 10, '15 m'),
    ('/register', 'Register Page', 'User registration page', 'auth', false, 10, '15 m'),
    ('/forgot-password', 'Forgot Password', 'Password reset request', 'sensitive', false, 5, '1 h'),
    ('/reset-password', 'Reset Password', 'Password reset page', 'sensitive', false, 5, '1 h'),
    ('/auth/callback', 'OAuth Callback', 'OAuth authentication callback', 'auth', false, 10, '15 m'),
    
    -- Group routes
    ('/groups/join', 'Join Group', 'Join group via invite code', 'public', false, 20, '1 m'),
    ('/api/groups/preview', 'Group Preview API', 'Preview group before joining', 'public', true, 20, '1 m'),
    
    -- Public routes
    ('/feedback', 'Feedback Page', 'User feedback submission', 'public', true, 20, '1 m'),
    ('/api/feedback', 'Feedback API', 'Feedback submission endpoint', 'public', true, 20, '1 m'),
    
    -- Expensive operations
    ('/groups/*/analytics', 'Group Analytics', 'Group analytics page (expensive)', 'expensive', true, 10, '1 m'),
    ('/api/cache', 'Cache API', 'Cache management endpoints', 'expensive', true, 10, '1 m'),
    
    -- General API
    ('/api/*', 'General API', 'All other API endpoints', 'api', true, 100, '1 m')
ON CONFLICT (route_pattern) DO NOTHING;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_rate_limit_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_rate_limit_settings_updated_at
    BEFORE UPDATE ON public.rate_limit_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_rate_limit_settings_updated_at();

-- Add comment
COMMENT ON TABLE public.rate_limit_settings IS 'Stores rate limiting configuration that can be toggled by site admins';

