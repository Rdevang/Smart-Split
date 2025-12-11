-- ============================================================================
-- PLACEHOLDER MEMBERS - For users who haven't signed up yet
-- ============================================================================

-- Placeholder members table for non-registered users
CREATE TABLE IF NOT EXISTS public.placeholder_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT, -- Optional, for sending invites later
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique index: same name+email combo per group (case insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_placeholder_unique_name_email 
    ON public.placeholder_members(group_id, LOWER(name), COALESCE(LOWER(email), ''));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_placeholder_members_group ON public.placeholder_members(group_id);
CREATE INDEX IF NOT EXISTS idx_placeholder_members_email ON public.placeholder_members(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_placeholder_members_created_by ON public.placeholder_members(created_by);

-- Update group_members to support both real users and placeholders
ALTER TABLE public.group_members 
    ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.group_members
    ADD COLUMN IF NOT EXISTS placeholder_id UUID REFERENCES public.placeholder_members(id) ON DELETE CASCADE;

-- Add constraint: must have either user_id OR placeholder_id (not both, not neither)
ALTER TABLE public.group_members
    ADD CONSTRAINT group_members_user_or_placeholder 
    CHECK (
        (user_id IS NOT NULL AND placeholder_id IS NULL) OR
        (user_id IS NULL AND placeholder_id IS NOT NULL)
    );

-- Update expense_splits to support placeholder members
ALTER TABLE public.expense_splits
    ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.expense_splits
    ADD COLUMN IF NOT EXISTS placeholder_id UUID REFERENCES public.placeholder_members(id) ON DELETE CASCADE;

-- Add constraint for expense_splits
ALTER TABLE public.expense_splits
    ADD CONSTRAINT expense_splits_user_or_placeholder
    CHECK (
        (user_id IS NOT NULL AND placeholder_id IS NULL) OR
        (user_id IS NULL AND placeholder_id IS NOT NULL)
    );

-- RLS Policies for placeholder_members
ALTER TABLE public.placeholder_members ENABLE ROW LEVEL SECURITY;

-- Users can view placeholders in groups they belong to
CREATE POLICY "Group members can view placeholders"
    ON public.placeholder_members FOR SELECT
    TO authenticated
    USING (
        public.is_group_member(group_id, auth.uid())
    );

-- Group admins can create placeholders
CREATE POLICY "Group admins can create placeholders"
    ON public.placeholder_members FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_group_admin(group_id, auth.uid())
        OR created_by = auth.uid()
    );

-- Creators can update their placeholders
CREATE POLICY "Creators can update placeholders"
    ON public.placeholder_members FOR UPDATE
    TO authenticated
    USING (created_by = auth.uid());

-- Creators can delete their placeholders
CREATE POLICY "Creators can delete placeholders"
    ON public.placeholder_members FOR DELETE
    TO authenticated
    USING (created_by = auth.uid());

-- Function to link placeholder to real user when they sign up
CREATE OR REPLACE FUNCTION public.link_placeholder_to_user(
    placeholder_uuid UUID,
    real_user_uuid UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    placeholder_record RECORD;
BEGIN
    -- Get placeholder details
    SELECT * INTO placeholder_record 
    FROM public.placeholder_members 
    WHERE id = placeholder_uuid;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Update group_members: change from placeholder to real user
    UPDATE public.group_members
    SET user_id = real_user_uuid, placeholder_id = NULL
    WHERE placeholder_id = placeholder_uuid;
    
    -- Update expense_splits: change from placeholder to real user
    UPDATE public.expense_splits
    SET user_id = real_user_uuid, placeholder_id = NULL
    WHERE placeholder_id = placeholder_uuid;
    
    -- Delete placeholder
    DELETE FROM public.placeholder_members WHERE id = placeholder_uuid;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update statistics
ANALYZE public.placeholder_members;

