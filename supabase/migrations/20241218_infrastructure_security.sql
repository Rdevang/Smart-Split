-- ============================================
-- Infrastructure Security Migration
-- Smart Split - December 18, 2024
-- ============================================
-- 
-- This migration adds additional security measures at the database level:
-- 1. Row-level security improvements
-- 2. Rate limiting tracking table
-- 3. Security events table
-- 4. Blocked IPs table
-- 5. Cleanup functions
-- ============================================

-- ============================================
-- 1. BLOCKED IPS TABLE (for manual IP blocking)
-- ============================================

CREATE TABLE IF NOT EXISTS blocked_ips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address TEXT NOT NULL,
    reason TEXT NOT NULL,
    blocked_by UUID REFERENCES profiles(id),
    blocked_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ, -- NULL = permanent
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    CONSTRAINT unique_active_ip UNIQUE (ip_address, is_active)
);

-- Index for quick IP lookups
CREATE INDEX IF NOT EXISTS idx_blocked_ips_lookup 
ON blocked_ips(ip_address, is_active) 
WHERE is_active = true;

-- RLS for blocked_ips (admin only)
ALTER TABLE blocked_ips ENABLE ROW LEVEL SECURITY;

-- Only authenticated users with admin role can manage blocked IPs
-- For now, any authenticated user can view (for transparency)
CREATE POLICY "Anyone can view blocked IPs"
ON blocked_ips FOR SELECT
TO authenticated
USING (true);

-- ============================================
-- 2. SECURITY EVENTS TABLE (for tracking)
-- ============================================

CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    user_id UUID REFERENCES profiles(id),
    ip_address TEXT,
    user_agent TEXT,
    path TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_event_type CHECK (
        event_type IN (
            'login_success', 'login_failure', 'login_blocked',
            'logout', 'password_change', 'password_reset',
            'mfa_enabled', 'mfa_disabled',
            'access_denied', 'permission_escalation',
            'rate_limit_exceeded', 'rate_limit_warning',
            'sensitive_data_access', 'bulk_data_export', 'data_deletion',
            'account_created', 'account_deleted', 'account_locked', 'account_unlocked',
            'suspicious_ip', 'suspicious_user_agent', 'suspicious_pattern', 'brute_force_detected',
            'csrf_violation', 'api_key_created', 'api_key_revoked', 'invalid_api_key'
        )
    )
);

-- Indexes for security event queries
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_ip ON security_events(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at DESC);

-- RLS for security_events
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own security events
CREATE POLICY "Users can view own security events"
ON security_events FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- ============================================
-- 3. RATE LIMIT TRACKING (for persistence)
-- ============================================

CREATE TABLE IF NOT EXISTS rate_limit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL, -- IP or user ID
    endpoint TEXT NOT NULL,
    limit_type TEXT NOT NULL,
    hit_at TIMESTAMPTZ DEFAULT NOW(),
    was_blocked BOOLEAN DEFAULT false
);

-- Index for rate limit queries
CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier ON rate_limit_events(identifier, endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limit_time ON rate_limit_events(hit_at DESC);

-- Auto-cleanup old rate limit events (older than 24 hours)
CREATE OR REPLACE FUNCTION cleanup_rate_limit_events()
RETURNS void AS $$
BEGIN
    DELETE FROM rate_limit_events
    WHERE hit_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. SESSION TRACKING IMPROVEMENTS
-- ============================================

-- Function to get active sessions for a user (for security dashboard)
CREATE OR REPLACE FUNCTION get_user_sessions(user_uuid UUID)
RETURNS TABLE (
    session_id UUID,
    created_at TIMESTAMPTZ,
    last_activity TIMESTAMPTZ,
    user_agent TEXT,
    ip_address TEXT
) AS $$
BEGIN
    -- This is a placeholder - actual implementation depends on 
    -- how you want to track sessions beyond Supabase's built-in
    RETURN QUERY SELECT 
        gen_random_uuid() as session_id,
        NOW() as created_at,
        NOW() as last_activity,
        'Unknown' as user_agent,
        'Unknown' as ip_address
    LIMIT 0; -- Returns empty for now
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. SECURITY CLEANUP FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_security_data()
RETURNS TABLE (
    security_events_deleted INTEGER,
    rate_limit_events_deleted INTEGER,
    expired_blocks_deactivated INTEGER
) AS $$
DECLARE
    v_security_deleted INTEGER;
    v_rate_deleted INTEGER;
    v_blocks_deactivated INTEGER;
BEGIN
    -- Clean up security events older than 1 year
    DELETE FROM security_events
    WHERE created_at < NOW() - INTERVAL '1 year';
    GET DIAGNOSTICS v_security_deleted = ROW_COUNT;
    
    -- Clean up rate limit events older than 24 hours
    DELETE FROM rate_limit_events
    WHERE hit_at < NOW() - INTERVAL '24 hours';
    GET DIAGNOSTICS v_rate_deleted = ROW_COUNT;
    
    -- Deactivate expired IP blocks
    UPDATE blocked_ips
    SET is_active = false
    WHERE expires_at IS NOT NULL 
    AND expires_at < NOW()
    AND is_active = true;
    GET DIAGNOSTICS v_blocks_deactivated = ROW_COUNT;
    
    RETURN QUERY SELECT v_security_deleted, v_rate_deleted, v_blocks_deactivated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. HELPER FUNCTION: Check if IP is blocked
-- ============================================

CREATE OR REPLACE FUNCTION is_ip_blocked(check_ip TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM blocked_ips
        WHERE ip_address = check_ip
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > NOW())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. HELPER FUNCTION: Log security event
-- ============================================

CREATE OR REPLACE FUNCTION log_security_event(
    p_event_type TEXT,
    p_severity TEXT,
    p_user_id UUID DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_path TEXT DEFAULT NULL,
    p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO security_events (
        event_type, severity, user_id, ip_address, user_agent, path, details
    ) VALUES (
        p_event_type, p_severity, p_user_id, p_ip_address, p_user_agent, p_path, p_details
    )
    RETURNING id INTO v_event_id;
    
    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. GRANT PERMISSIONS
-- ============================================

-- Grant access to security functions for authenticated users
GRANT EXECUTE ON FUNCTION is_ip_blocked(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION log_security_event(TEXT, TEXT, UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;

-- Grant cleanup functions to service role only
GRANT EXECUTE ON FUNCTION cleanup_security_data() TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_rate_limit_events() TO service_role;

-- ============================================
-- 9. COMMENTS
-- ============================================

COMMENT ON TABLE blocked_ips IS 'Stores manually blocked IP addresses for security';
COMMENT ON TABLE security_events IS 'Audit log for security-related events';
COMMENT ON TABLE rate_limit_events IS 'Tracks rate limit hits for analysis';
COMMENT ON FUNCTION is_ip_blocked IS 'Check if an IP address is currently blocked';
COMMENT ON FUNCTION log_security_event IS 'Log a security event to the audit table';
COMMENT ON FUNCTION cleanup_security_data IS 'Clean up old security data (run via cron)';

