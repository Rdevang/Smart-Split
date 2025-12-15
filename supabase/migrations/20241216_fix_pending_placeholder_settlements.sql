-- ============================================================================
-- Fix pending settlements that involve placeholder members
-- These should have been auto-approved since placeholders can't respond
-- ============================================================================

-- Update settlements where from_placeholder_id or to_placeholder_id is set
UPDATE public.settlements
SET 
    status = 'approved',
    settled_at = COALESCE(settled_at, requested_at, NOW())
WHERE status = 'pending'
AND (from_placeholder_id IS NOT NULL OR to_placeholder_id IS NOT NULL);

-- Also fix old settlements where placeholder ID was stored in from_user/to_user columns
-- by checking if the UUID exists in placeholder_members but NOT in profiles
UPDATE public.settlements s
SET 
    status = 'approved',
    settled_at = COALESCE(s.settled_at, s.requested_at, NOW())
WHERE s.status = 'pending'
AND (
    -- Check if to_user is actually a placeholder
    (s.to_user IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.placeholder_members pm WHERE pm.id = s.to_user
    ) AND NOT EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = s.to_user
    ))
    OR
    -- Check if from_user is actually a placeholder
    (s.from_user IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.placeholder_members pm WHERE pm.id = s.from_user
    ) AND NOT EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = s.from_user
    ))
);

-- Analyze for query planner
ANALYZE public.settlements;

