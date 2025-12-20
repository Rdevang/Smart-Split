-- Fix RLS on rate_limit_events table
-- This table should not be publicly accessible

-- Enable RLS
ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;

-- No public access - only service role can access this table
-- (Rate limiting is handled server-side, not client-side)

-- Drop any existing policies
DROP POLICY IF EXISTS "No public access" ON public.rate_limit_events;

-- Create restrictive policy - deny all access via API
-- Only service_role (server-side) can access this table
CREATE POLICY "Service role only"
    ON public.rate_limit_events
    FOR ALL
    USING (false)
    WITH CHECK (false);

-- If you need to allow service role to insert/read, use this instead:
-- Note: service_role bypasses RLS by default, so this policy blocks
-- only anon and authenticated roles from accessing the table

