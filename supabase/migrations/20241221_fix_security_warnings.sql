-- Fix Function Search Path Security Warnings
-- Setting search_path to empty string prevents search path injection attacks

-- 1. cleanup_rate_limit_events
ALTER FUNCTION public.cleanup_rate_limit_events() SET search_path = '';

-- 2. get_user_sessions
ALTER FUNCTION public.get_user_sessions(uuid) SET search_path = '';

-- 3. generate_invite_code
ALTER FUNCTION public.generate_invite_code() SET search_path = '';

-- 4. regenerate_group_invite_code
ALTER FUNCTION public.regenerate_group_invite_code(uuid) SET search_path = '';

-- 5. is_ip_blocked
ALTER FUNCTION public.is_ip_blocked(inet) SET search_path = '';

-- 6. join_group_by_invite_code
ALTER FUNCTION public.join_group_by_invite_code(text, uuid) SET search_path = '';

-- 7. log_security_event
ALTER FUNCTION public.log_security_event(text, text, jsonb, inet, text) SET search_path = '';

-- 8. cleanup_security_data
ALTER FUNCTION public.cleanup_security_data() SET search_path = '';

-- 9. is_admin
ALTER FUNCTION public.is_admin(uuid) SET search_path = '';

-- 10. is_site_admin
ALTER FUNCTION public.is_site_admin(uuid) SET search_path = '';

-- 11. approve_settlement
ALTER FUNCTION public.approve_settlement(uuid, uuid) SET search_path = '';

-- 12. reject_settlement
ALTER FUNCTION public.reject_settlement(uuid, uuid, text) SET search_path = '';

-- 13. get_group_balances
ALTER FUNCTION public.get_group_balances(uuid) SET search_path = '';

-- Note: After running this, you may need to update function bodies to use
-- fully qualified table names (e.g., public.groups instead of groups)
-- if any functions break.

