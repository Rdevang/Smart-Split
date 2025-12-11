-- ============================================================================
-- FIX: Groups INSERT policy
-- ============================================================================

-- Drop existing INSERT policy if it exists
DROP POLICY IF EXISTS "Authenticated users can create groups" ON public.groups;

-- Create a more permissive INSERT policy
-- Any authenticated user can create a group, as long as they set themselves as creator
CREATE POLICY "Authenticated users can create groups"
  ON public.groups FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND (created_by IS NULL OR created_by = auth.uid())
  );

-- Also fix the group_members INSERT policy to allow first member
DROP POLICY IF EXISTS "Admins can add members" ON public.group_members;

CREATE POLICY "Admins can add members or first member"
  ON public.group_members FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User is adding themselves as first member (group creator)
    (user_id = auth.uid())
    OR
    -- User is admin of the group
    public.is_group_admin(group_id, auth.uid())
  );

