-- ============================================================================
-- FIX SEARCH_PATH FOR EMAIL FUNCTIONS
-- Sets search_path = '' and fully qualifies all table references
-- ============================================================================

-- 1. Fix user_wants_email
-- ============================================================================
DROP FUNCTION IF EXISTS public.user_wants_email(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.user_wants_email(
    p_user_id UUID,
    p_email_type TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_preferences JSONB;
    v_pref_key TEXT;
BEGIN
    v_pref_key := CASE p_email_type
        WHEN 'payment_reminder' THEN 'payment_reminders'
        WHEN 'settlement_request' THEN 'settlement_requests'
        WHEN 'settlement_approved' THEN 'settlement_updates'
        WHEN 'settlement_rejected' THEN 'settlement_updates'
        WHEN 'group_invitation' THEN 'group_invitations'
        WHEN 'expense_added' THEN 'expense_added'
        WHEN 'weekly_digest' THEN 'weekly_digest'
        ELSE 'payment_reminders'
    END;
    
    SELECT email_preferences INTO v_preferences
    FROM public.profiles
    WHERE id = p_user_id;
    
    RETURN COALESCE((v_preferences ->> v_pref_key)::boolean, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 2. Fix queue_email
-- ============================================================================
DROP FUNCTION IF EXISTS public.queue_email(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ, TEXT);

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
    IF p_user_id IS NOT NULL THEN
        v_wants_email := public.user_wants_email(p_user_id, p_email_type);
        IF NOT v_wants_email THEN
            RETURN NULL;
        END IF;
    END IF;
    
    IF p_idempotency_key IS NULL THEN
        p_idempotency_key := md5(p_email || p_email_type || p_subject || NOW()::text);
    END IF;
    
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 3. Fix get_pending_emails
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_pending_emails(INT);

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 4. Fix mark_email_processed
-- ============================================================================
DROP FUNCTION IF EXISTS public.mark_email_processed(UUID, TEXT, TEXT, TEXT);

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 5. Fix get_users_for_weekly_digest
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_users_for_weekly_digest();

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
        COALESCE((p.email_preferences ->> 'weekly_digest')::boolean, true) = true
        AND p.email IS NOT NULL
        AND (p.last_digest_sent_at IS NULL OR p.last_digest_sent_at < NOW() - INTERVAL '6 days');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 6. Fix cleanup_old_emails
-- ============================================================================
DROP FUNCTION IF EXISTS public.cleanup_old_emails();

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 7. Fix update_rate_limit_settings_updated_at
-- ============================================================================
-- Drop trigger first, then function, then recreate both
DROP TRIGGER IF EXISTS trigger_rate_limit_settings_updated_at ON public.rate_limit_settings;
DROP FUNCTION IF EXISTS public.update_rate_limit_settings_updated_at();

CREATE OR REPLACE FUNCTION public.update_rate_limit_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- Recreate the trigger
CREATE TRIGGER trigger_rate_limit_settings_updated_at
    BEFORE UPDATE ON public.rate_limit_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_rate_limit_settings_updated_at();

-- 8. Re-grant permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.user_wants_email(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.queue_email(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_emails(INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_email_processed(UUID, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_users_for_weekly_digest() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_emails() TO service_role;

