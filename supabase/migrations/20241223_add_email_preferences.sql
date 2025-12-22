-- ============================================================================
-- EMAIL PREFERENCES & QUEUE SYSTEM
-- Designed for scale: queue-based processing, user preferences, batch sending
-- ============================================================================

-- 1. Add email preferences to profiles
-- ============================================================================
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email_preferences JSONB DEFAULT '{
    "payment_reminders": true,
    "settlement_requests": true,
    "settlement_updates": true,
    "group_invitations": true,
    "expense_added": false,
    "weekly_digest": true
}'::jsonb;

-- Add last digest sent timestamp
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_digest_sent_at TIMESTAMPTZ;

-- 2. Create email queue table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.email_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Recipient info
    to_email TEXT NOT NULL,
    to_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Email content
    email_type TEXT NOT NULL,
    subject TEXT NOT NULL,
    html_body TEXT NOT NULL,
    text_body TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Processing status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'skipped')),
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 3,
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    scheduled_for TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    
    -- Prevent duplicates within a time window
    idempotency_key TEXT UNIQUE
);

-- Indexes for efficient queue processing
CREATE INDEX IF NOT EXISTS idx_email_queue_status_scheduled 
    ON public.email_queue(status, scheduled_for) 
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_email_queue_user 
    ON public.email_queue(to_user_id);

CREATE INDEX IF NOT EXISTS idx_email_queue_type 
    ON public.email_queue(email_type);

-- 3. Create email logs table (for analytics and debugging)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_id UUID REFERENCES public.email_queue(id) ON DELETE SET NULL,
    to_email TEXT NOT NULL,
    to_user_id UUID,
    email_type TEXT NOT NULL,
    status TEXT NOT NULL,
    provider_id TEXT, -- Resend message ID
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_user 
    ON public.email_logs(to_user_id);

CREATE INDEX IF NOT EXISTS idx_email_logs_created 
    ON public.email_logs(created_at DESC);

-- 4. Function to check if user wants this email type
-- ============================================================================
CREATE OR REPLACE FUNCTION public.user_wants_email(
    p_user_id UUID,
    p_email_type TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_preferences JSONB;
    v_pref_key TEXT;
BEGIN
    -- Map email types to preference keys
    v_pref_key := CASE p_email_type
        WHEN 'payment_reminder' THEN 'payment_reminders'
        WHEN 'settlement_request' THEN 'settlement_requests'
        WHEN 'settlement_approved' THEN 'settlement_updates'
        WHEN 'settlement_rejected' THEN 'settlement_updates'
        WHEN 'group_invitation' THEN 'group_invitations'
        WHEN 'expense_added' THEN 'expense_added'
        WHEN 'weekly_digest' THEN 'weekly_digest'
        ELSE 'payment_reminders' -- Default to true
    END;
    
    SELECT email_preferences INTO v_preferences
    FROM public.profiles
    WHERE id = p_user_id;
    
    -- Default to true if preference not set
    RETURN COALESCE((v_preferences ->> v_pref_key)::boolean, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Function to queue an email (respects preferences)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.queue_email(
    p_user_id UUID,
    p_email TEXT,
    p_email_type TEXT,
    p_subject TEXT,
    p_html_body TEXT,
    p_text_body TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}',
    p_scheduled_for TIMESTAMPTZ DEFAULT NOW(),
    p_idempotency_key TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_queue_id UUID;
    v_wants_email BOOLEAN;
BEGIN
    -- Check if user wants this type of email
    IF p_user_id IS NOT NULL THEN
        v_wants_email := public.user_wants_email(p_user_id, p_email_type);
        IF NOT v_wants_email THEN
            RETURN NULL; -- User opted out
        END IF;
    END IF;
    
    -- Generate idempotency key if not provided
    IF p_idempotency_key IS NULL THEN
        p_idempotency_key := md5(p_email || p_email_type || p_subject || NOW()::text);
    END IF;
    
    -- Insert into queue (ON CONFLICT prevents duplicates)
    INSERT INTO public.email_queue (
        to_email,
        to_user_id,
        email_type,
        subject,
        html_body,
        text_body,
        metadata,
        scheduled_for,
        idempotency_key
    ) VALUES (
        p_email,
        p_user_id,
        p_email_type,
        p_subject,
        p_html_body,
        p_text_body,
        p_metadata,
        p_scheduled_for,
        p_idempotency_key
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO v_queue_id;
    
    RETURN v_queue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Function to get pending emails for processing (with locking)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_pending_emails(
    p_batch_size INT DEFAULT 50
) RETURNS SETOF public.email_queue AS $$
BEGIN
    RETURN QUERY
    UPDATE public.email_queue
    SET 
        status = 'processing',
        attempts = attempts + 1
    WHERE id IN (
        SELECT id FROM public.email_queue
        WHERE status = 'pending'
          AND scheduled_for <= NOW()
          AND attempts < max_attempts
        ORDER BY scheduled_for ASC
        LIMIT p_batch_size
        FOR UPDATE SKIP LOCKED
    )
    RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Function to mark email as sent/failed
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mark_email_processed(
    p_queue_id UUID,
    p_status TEXT,
    p_provider_id TEXT DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    UPDATE public.email_queue
    SET 
        status = p_status,
        processed_at = NOW(),
        error_message = p_error_message
    WHERE id = p_queue_id;
    
    -- Log the result
    INSERT INTO public.email_logs (
        queue_id,
        to_email,
        to_user_id,
        email_type,
        status,
        provider_id,
        error_message
    )
    SELECT 
        id,
        to_email,
        to_user_id,
        email_type,
        p_status,
        p_provider_id,
        p_error_message
    FROM public.email_queue
    WHERE id = p_queue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Function to get users needing weekly digest
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_users_for_weekly_digest()
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    full_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.email,
        p.full_name
    FROM public.profiles p
    WHERE 
        -- User wants weekly digest
        COALESCE((p.email_preferences ->> 'weekly_digest')::boolean, true) = true
        -- Email exists
        AND p.email IS NOT NULL
        -- Haven't sent digest in last 6 days (allow some buffer)
        AND (p.last_digest_sent_at IS NULL OR p.last_digest_sent_at < NOW() - INTERVAL '6 days');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. RLS Policies
-- ============================================================================
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Only service role can access email queue (for cron jobs)
CREATE POLICY "Service role can manage email queue"
    ON public.email_queue FOR ALL
    USING (auth.role() = 'service_role');

-- Users can view their own email logs
CREATE POLICY "Users can view own email logs"
    ON public.email_logs FOR SELECT
    USING (to_user_id = auth.uid());

-- Service role can manage all logs
CREATE POLICY "Service role can manage email logs"
    ON public.email_logs FOR ALL
    USING (auth.role() = 'service_role');

-- 10. Grant permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.user_wants_email(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.queue_email(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_emails(INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_email_processed(UUID, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_users_for_weekly_digest() TO service_role;

-- 11. Cleanup old emails (keep 30 days)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cleanup_old_emails()
RETURNS INT AS $$
DECLARE
    v_deleted INT;
BEGIN
    DELETE FROM public.email_queue
    WHERE created_at < NOW() - INTERVAL '30 days'
      AND status IN ('sent', 'failed', 'skipped');
    
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    
    DELETE FROM public.email_logs
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.cleanup_old_emails() TO service_role;

