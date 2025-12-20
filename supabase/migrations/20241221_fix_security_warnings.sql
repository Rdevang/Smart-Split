-- Fix Function Search Path Security Warnings
-- Setting search_path to empty string prevents search path injection attacks

-- 1. approve_settlement(settlement_uuid uuid)
ALTER FUNCTION public.approve_settlement(uuid) SET search_path = '';

-- 2. cleanup_rate_limit_events()
ALTER FUNCTION public.cleanup_rate_limit_events() SET search_path = '';

-- 3. cleanup_security_data()
ALTER FUNCTION public.cleanup_security_data() SET search_path = '';

-- 4. generate_invite_code(length integer)
ALTER FUNCTION public.generate_invite_code(integer) SET search_path = '';

-- 5. get_group_balances(group_uuid uuid)
ALTER FUNCTION public.get_group_balances(uuid) SET search_path = '';

-- 6. get_user_sessions(user_uuid uuid)
ALTER FUNCTION public.get_user_sessions(uuid) SET search_path = '';

-- 7. is_admin()
ALTER FUNCTION public.is_admin() SET search_path = '';

-- 8. is_ip_blocked(check_ip text)
ALTER FUNCTION public.is_ip_blocked(text) SET search_path = '';

-- 9. is_site_admin()
ALTER FUNCTION public.is_site_admin() SET search_path = '';

-- 10. join_group_by_invite_code(code varchar, joining_user_id uuid)
ALTER FUNCTION public.join_group_by_invite_code(character varying, uuid) SET search_path = '';

-- 11. log_security_event(p_event_type text, p_severity text, p_user_id uuid, p_ip_address text, p_user_agent text, p_path text, p_details jsonb)
ALTER FUNCTION public.log_security_event(text, text, uuid, text, text, text, jsonb) SET search_path = '';

-- 12. regenerate_group_invite_code(group_uuid uuid)
ALTER FUNCTION public.regenerate_group_invite_code(uuid) SET search_path = '';

-- 13. reject_settlement(settlement_uuid uuid)
ALTER FUNCTION public.reject_settlement(uuid) SET search_path = '';

