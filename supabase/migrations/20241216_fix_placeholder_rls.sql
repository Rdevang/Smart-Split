-- ============================================================================
-- FIX: Placeholder Members RLS Policy
-- The previous policy was overly complex and caused issues with nested joins
-- Simply check if user is a member of the group that the placeholder belongs to
-- ============================================================================

-- Drop the problematic policy
DROP POLICY IF EXISTS "Group members can view placeholders" ON public.placeholder_members;

-- Create a simpler, direct policy using placeholder_members.group_id
CREATE POLICY "Group members can view placeholders" ON public.placeholder_members
    FOR SELECT 
    TO authenticated
    USING (
        public.is_group_member(group_id, (SELECT auth.uid()))
    );

-- Analyze the table for better query planning
ANALYZE public.placeholder_members;

