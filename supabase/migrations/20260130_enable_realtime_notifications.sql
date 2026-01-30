-- ============================================================================
-- Enable Supabase Realtime for notifications
-- ============================================================================
-- This allows real-time subscriptions to notification changes
-- RLS policies are respected, so users only receive their own notifications

-- Enable Realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Enable Realtime for group_invitations table
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_invitations;
