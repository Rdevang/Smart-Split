-- Fix functions that broke due to empty search_path
-- When search_path='', functions need to use fully qualified table names (public.tablename)

-- =====================================================
-- 1. FIX join_group_by_invite_code
-- =====================================================
CREATE OR REPLACE FUNCTION public.join_group_by_invite_code(code VARCHAR, joining_user_id UUID)
RETURNS JSON AS $$
DECLARE
    target_group_id UUID;
    group_name VARCHAR;
    existing_member UUID;
BEGIN
    -- Find the group with this invite code (use public schema)
    SELECT id, name INTO target_group_id, group_name
    FROM public.groups
    WHERE invite_code = UPPER(code);
    
    IF target_group_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Invalid invite code');
    END IF;
    
    -- Check if already a member
    SELECT id INTO existing_member
    FROM public.group_members
    WHERE group_id = target_group_id AND user_id = joining_user_id;
    
    IF existing_member IS NOT NULL THEN
        RETURN json_build_object('success', false, 'error', 'You are already a member of this group', 'group_id', target_group_id);
    END IF;
    
    -- Add user as member
    INSERT INTO public.group_members (group_id, user_id, role)
    VALUES (target_group_id, joining_user_id, 'member');
    
    -- Log activity
    INSERT INTO public.activities (user_id, group_id, entity_type, entity_id, action, metadata)
    VALUES (joining_user_id, target_group_id, 'member', joining_user_id, 'joined', 
            json_build_object('via', 'invite_code'));
    
    RETURN json_build_object('success', true, 'group_id', target_group_id, 'group_name', group_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- =====================================================
-- 2. FIX regenerate_group_invite_code
-- =====================================================
CREATE OR REPLACE FUNCTION public.regenerate_group_invite_code(group_uuid UUID)
RETURNS VARCHAR AS $$
DECLARE
    new_code VARCHAR;
    max_attempts INTEGER := 100;
    attempts INTEGER := 0;
BEGIN
    LOOP
        new_code := public.generate_invite_code(8);
        BEGIN
            UPDATE public.groups SET invite_code = new_code, updated_at = NOW() WHERE id = group_uuid;
            RETURN new_code;
        EXCEPTION WHEN unique_violation THEN
            attempts := attempts + 1;
            IF attempts >= max_attempts THEN
                RAISE EXCEPTION 'Could not generate unique invite code after % attempts', max_attempts;
            END IF;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- =====================================================
-- 3. FIX get_group_balances
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_group_balances(group_uuid UUID)
RETURNS TABLE(user_id UUID, user_name TEXT, balance DECIMAL, is_placeholder BOOLEAN) AS $$
BEGIN
    RETURN QUERY
    WITH expense_payments AS (
        -- Money paid by each member
        SELECT 
            COALESCE(e.paid_by, e.paid_by_placeholder_id) as member_id,
            e.paid_by IS NOT NULL as is_user,
            SUM(e.amount) as total_paid
        FROM public.expenses e
        WHERE e.group_id = group_uuid
        GROUP BY COALESCE(e.paid_by, e.paid_by_placeholder_id), e.paid_by IS NOT NULL
    ),
    expense_splits AS (
        -- Money owed by each member (from unsettled splits)
        SELECT 
            COALESCE(es.user_id, es.placeholder_id) as member_id,
            es.user_id IS NOT NULL as is_user,
            SUM(es.amount) as total_owed
        FROM public.expense_splits es
        JOIN public.expenses e ON e.id = es.expense_id
        WHERE e.group_id = group_uuid
          AND (es.is_settled IS NULL OR es.is_settled = FALSE)
        GROUP BY COALESCE(es.user_id, es.placeholder_id), es.user_id IS NOT NULL
    ),
    settlements_made AS (
        -- Settlements from this member to others (reduces what they owe)
        SELECT 
            COALESCE(s.from_user, s.from_placeholder_id) as member_id,
            s.from_user IS NOT NULL as is_user,
            SUM(s.amount) as total_settled
        FROM public.settlements s
        WHERE s.group_id = group_uuid
          AND s.status = 'approved'
        GROUP BY COALESCE(s.from_user, s.from_placeholder_id), s.from_user IS NOT NULL
    ),
    settlements_received AS (
        -- Settlements received by this member (reduces what others owe them)
        SELECT 
            COALESCE(s.to_user, s.to_placeholder_id) as member_id,
            s.to_user IS NOT NULL as is_user,
            SUM(s.amount) as total_received
        FROM public.settlements s
        WHERE s.group_id = group_uuid
          AND s.status = 'approved'
        GROUP BY COALESCE(s.to_user, s.to_placeholder_id), s.to_user IS NOT NULL
    ),
    all_members AS (
        -- Get all members (users and placeholders)
        SELECT 
            gm.user_id as member_id,
            TRUE as is_user,
            COALESCE(p.full_name, p.email, 'Unknown') as member_name
        FROM public.group_members gm
        LEFT JOIN public.profiles p ON p.id = gm.user_id
        WHERE gm.group_id = group_uuid AND gm.user_id IS NOT NULL
        UNION ALL
        SELECT 
            gm.placeholder_id as member_id,
            FALSE as is_user,
            pm.name as member_name
        FROM public.group_members gm
        JOIN public.placeholder_members pm ON pm.id = gm.placeholder_id
        WHERE gm.group_id = group_uuid AND gm.placeholder_id IS NOT NULL
    )
    SELECT 
        am.member_id as user_id,
        am.member_name as user_name,
        ROUND(
            COALESCE(ep.total_paid, 0) - 
            COALESCE(es.total_owed, 0) + 
            COALESCE(sm.total_settled, 0) - 
            COALESCE(sr.total_received, 0)
        , 2)::DECIMAL as balance,
        NOT am.is_user as is_placeholder
    FROM all_members am
    LEFT JOIN expense_payments ep ON ep.member_id = am.member_id
    LEFT JOIN expense_splits es ON es.member_id = am.member_id  
    LEFT JOIN settlements_made sm ON sm.member_id = am.member_id
    LEFT JOIN settlements_received sr ON sr.member_id = am.member_id
    ORDER BY balance DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- =====================================================
-- 4. FIX approve_settlement
-- =====================================================
CREATE OR REPLACE FUNCTION public.approve_settlement(settlement_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_settlement RECORD;
BEGIN
    -- Get settlement details
    SELECT * INTO v_settlement
    FROM public.settlements
    WHERE id = settlement_uuid;
    
    IF v_settlement IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Update settlement status
    UPDATE public.settlements
    SET status = 'approved', settled_at = NOW()
    WHERE id = settlement_uuid;
    
    -- Log activity
    INSERT INTO public.activities (user_id, group_id, entity_type, entity_id, action, metadata)
    VALUES (
        v_settlement.to_user,
        v_settlement.group_id,
        'settlement',
        settlement_uuid,
        'approved',
        json_build_object('amount', v_settlement.amount, 'from_user', v_settlement.from_user)
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- =====================================================
-- 5. FIX reject_settlement
-- =====================================================
CREATE OR REPLACE FUNCTION public.reject_settlement(settlement_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_settlement RECORD;
BEGIN
    -- Get settlement details
    SELECT * INTO v_settlement
    FROM public.settlements
    WHERE id = settlement_uuid;
    
    IF v_settlement IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Update settlement status
    UPDATE public.settlements
    SET status = 'rejected'
    WHERE id = settlement_uuid;
    
    -- Log activity
    INSERT INTO public.activities (user_id, group_id, entity_type, entity_id, action, metadata)
    VALUES (
        v_settlement.to_user,
        v_settlement.group_id,
        'settlement',
        settlement_uuid,
        'rejected',
        json_build_object('amount', v_settlement.amount, 'from_user', v_settlement.from_user)
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- =====================================================
-- 6. FIX log_security_event
-- =====================================================
-- Must DROP first because existing function has default parameters that can't be removed via CREATE OR REPLACE
DROP FUNCTION IF EXISTS public.log_security_event(TEXT, TEXT, UUID, TEXT, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.log_security_event(
    p_event_type TEXT,
    p_severity TEXT,
    p_user_id UUID,
    p_ip_address TEXT,
    p_user_agent TEXT,
    p_path TEXT,
    p_details JSONB
)
RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO public.security_events (
        event_type, severity, user_id, ip_address, user_agent, path, details
    ) VALUES (
        p_event_type, p_severity, p_user_id, p_ip_address, p_user_agent, p_path, p_details
    )
    RETURNING id INTO v_event_id;
    
    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- =====================================================
-- 7. FIX cleanup_security_data
-- =====================================================
CREATE OR REPLACE FUNCTION public.cleanup_security_data()
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
    DELETE FROM public.security_events
    WHERE created_at < NOW() - INTERVAL '1 year';
    GET DIAGNOSTICS v_security_deleted = ROW_COUNT;
    
    -- Clean up rate limit events older than 24 hours
    DELETE FROM public.rate_limit_events
    WHERE created_at < NOW() - INTERVAL '24 hours';
    GET DIAGNOSTICS v_rate_deleted = ROW_COUNT;
    
    -- Deactivate expired IP blocks
    UPDATE public.blocked_ips
    SET is_active = FALSE
    WHERE expires_at IS NOT NULL AND expires_at < NOW() AND is_active = TRUE;
    GET DIAGNOSTICS v_blocks_deactivated = ROW_COUNT;
    
    security_events_deleted := v_security_deleted;
    rate_limit_events_deleted := v_rate_deleted;
    expired_blocks_deactivated := v_blocks_deactivated;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- =====================================================
-- 8. FIX is_ip_blocked
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_ip_blocked(check_ip TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.blocked_ips
        WHERE ip_address = check_ip
          AND is_active = TRUE
          AND (expires_at IS NULL OR expires_at > NOW())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.join_group_by_invite_code(VARCHAR, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.regenerate_group_invite_code(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_balances(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_settlement(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_settlement(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_security_event(TEXT, TEXT, UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_security_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_ip_blocked(TEXT) TO authenticated;

