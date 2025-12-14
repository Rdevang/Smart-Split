-- ============================================================================
-- Notifications table for user notifications
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'group_invite', 'expense_added', 'settlement', 'friend_request', etc.
    title TEXT NOT NULL,
    message TEXT,
    data JSONB DEFAULT '{}', -- Additional data (group_id, expense_id, etc.)
    is_read BOOLEAN DEFAULT FALSE,
    action_url TEXT, -- URL to navigate to when clicked
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
    ON public.notifications FOR DELETE
    USING (auth.uid() = user_id);

-- Allow system to create notifications (via service role or authenticated users inviting others)
CREATE POLICY "Authenticated users can create notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- Group invitations table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.group_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    invited_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    UNIQUE(group_id, invited_user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_group_invitations_user ON public.group_invitations(invited_user_id, status);
CREATE INDEX IF NOT EXISTS idx_group_invitations_group ON public.group_invitations(group_id);

-- RLS
ALTER TABLE public.group_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view invitations they sent or received"
    ON public.group_invitations FOR SELECT
    USING (auth.uid() = invited_user_id OR auth.uid() = invited_by);

CREATE POLICY "Users can create invitations"
    ON public.group_invitations FOR INSERT
    WITH CHECK (auth.uid() = invited_by);

CREATE POLICY "Invited users can update their invitations"
    ON public.group_invitations FOR UPDATE
    USING (auth.uid() = invited_user_id);

