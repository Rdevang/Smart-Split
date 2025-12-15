-- ============================================================================
-- Allow settlements with placeholder members
-- Add placeholder columns to settlements table
-- ============================================================================

-- Add placeholder columns
ALTER TABLE public.settlements
    ALTER COLUMN from_user DROP NOT NULL;

ALTER TABLE public.settlements
    ADD COLUMN IF NOT EXISTS from_placeholder_id UUID REFERENCES public.placeholder_members(id) ON DELETE CASCADE;

ALTER TABLE public.settlements
    ALTER COLUMN to_user DROP NOT NULL;

ALTER TABLE public.settlements
    ADD COLUMN IF NOT EXISTS to_placeholder_id UUID REFERENCES public.placeholder_members(id) ON DELETE CASCADE;

-- Drop the old check constraint
ALTER TABLE public.settlements
    DROP CONSTRAINT IF EXISTS settlements_check;

-- Add new constraints:
-- 1. Either from_user OR from_placeholder_id must be set (not both, not neither)
-- 2. Either to_user OR to_placeholder_id must be set (not both, not neither)
-- 3. Payer and payee can't be the same person
ALTER TABLE public.settlements
    ADD CONSTRAINT settlements_from_user_or_placeholder 
    CHECK (
        (from_user IS NOT NULL AND from_placeholder_id IS NULL) OR
        (from_user IS NULL AND from_placeholder_id IS NOT NULL)
    );

ALTER TABLE public.settlements
    ADD CONSTRAINT settlements_to_user_or_placeholder 
    CHECK (
        (to_user IS NOT NULL AND to_placeholder_id IS NULL) OR
        (to_user IS NULL AND to_placeholder_id IS NOT NULL)
    );

-- Can't settle with yourself (when both are real users or both are placeholders)
ALTER TABLE public.settlements
    ADD CONSTRAINT settlements_not_self
    CHECK (
        (from_user IS NULL OR to_user IS NULL OR from_user != to_user) AND
        (from_placeholder_id IS NULL OR to_placeholder_id IS NULL OR from_placeholder_id != to_placeholder_id)
    );

-- Add indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_settlements_from_placeholder ON public.settlements(from_placeholder_id) WHERE from_placeholder_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_settlements_to_placeholder ON public.settlements(to_placeholder_id) WHERE to_placeholder_id IS NOT NULL;

-- Update RLS policies to include placeholder settlements
DROP POLICY IF EXISTS "Users can view settlements in their groups" ON public.settlements;
CREATE POLICY "Users can view settlements in their groups" ON public.settlements
    FOR SELECT USING (
        public.is_group_member(group_id, (SELECT auth.uid()))
    );

DROP POLICY IF EXISTS "Users can create settlements" ON public.settlements;
CREATE POLICY "Users can create settlements" ON public.settlements
    FOR INSERT WITH CHECK (
        public.is_group_member(group_id, (SELECT auth.uid()))
    );

-- Analyze for query optimization
ANALYZE public.settlements;

