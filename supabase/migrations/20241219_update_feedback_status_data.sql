-- ============================================
-- STEP 2: Update existing data to use new status values
-- Run this AFTER the first migration is committed
-- ============================================

-- Update existing 'new' status to 'submitted' for consistency
UPDATE public.feedback SET status = 'submitted' WHERE status = 'new';

-- Update existing 'reviewing' to 'under_review'
UPDATE public.feedback SET status = 'under_review' WHERE status = 'reviewing';

-- Update existing 'declined' to 'rejected'
UPDATE public.feedback SET status = 'rejected' WHERE status = 'declined';

-- Update existing 'completed' to 'approved'
UPDATE public.feedback SET status = 'approved' WHERE status = 'completed';

