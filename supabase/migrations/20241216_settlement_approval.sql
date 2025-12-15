-- ============================================================================
-- Settlement Approval Workflow
-- Settlements now require approval from the recipient before being finalized
-- ============================================================================

-- Add status column to settlements
ALTER TABLE public.settlements
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' 
    CHECK (status IN ('pending', 'approved', 'rejected'));

-- Add requested_at and responded_at timestamps
ALTER TABLE public.settlements
    ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.settlements
    ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;

-- Add requested_by column (who initiated the settlement)
ALTER TABLE public.settlements
    ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Index for quick lookup of pending settlements
CREATE INDEX IF NOT EXISTS idx_settlements_status ON public.settlements(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_settlements_to_user_pending ON public.settlements(to_user, status) WHERE status = 'pending';

-- Update settled_at to only be set when approved
-- (It's already nullable, but let's make sure new records don't set it by default)
ALTER TABLE public.settlements
    ALTER COLUMN settled_at DROP DEFAULT;

-- Function to approve a settlement
CREATE OR REPLACE FUNCTION public.approve_settlement(settlement_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    settlement_record RECORD;
    current_user_id UUID;
BEGIN
    current_user_id := auth.uid();
    
    -- Get the settlement
    SELECT * INTO settlement_record 
    FROM public.settlements 
    WHERE id = settlement_uuid;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Settlement not found';
    END IF;
    
    -- Check if current user is the recipient (to_user)
    IF settlement_record.to_user != current_user_id THEN
        RAISE EXCEPTION 'Only the recipient can approve this settlement';
    END IF;
    
    -- Check if already processed
    IF settlement_record.status != 'pending' THEN
        RAISE EXCEPTION 'Settlement has already been processed';
    END IF;
    
    -- Approve the settlement
    UPDATE public.settlements
    SET 
        status = 'approved',
        settled_at = NOW(),
        responded_at = NOW()
    WHERE id = settlement_uuid;
    
    -- Mark related expense splits as settled
    IF settlement_record.from_user IS NOT NULL THEN
        -- From real user
        UPDATE public.expense_splits es
        SET is_settled = true, settled_at = NOW()
        FROM public.expenses e
        WHERE es.expense_id = e.id
        AND e.group_id = settlement_record.group_id
        AND e.paid_by = settlement_record.to_user
        AND es.user_id = settlement_record.from_user
        AND es.is_settled = false;
    ELSE
        -- From placeholder
        UPDATE public.expense_splits es
        SET is_settled = true, settled_at = NOW()
        FROM public.expenses e
        WHERE es.expense_id = e.id
        AND e.group_id = settlement_record.group_id
        AND e.paid_by = settlement_record.to_user
        AND es.placeholder_id = settlement_record.from_placeholder_id
        AND es.is_settled = false;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reject a settlement
CREATE OR REPLACE FUNCTION public.reject_settlement(settlement_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    settlement_record RECORD;
    current_user_id UUID;
BEGIN
    current_user_id := auth.uid();
    
    -- Get the settlement
    SELECT * INTO settlement_record 
    FROM public.settlements 
    WHERE id = settlement_uuid;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Settlement not found';
    END IF;
    
    -- Check if current user is the recipient (to_user)
    IF settlement_record.to_user != current_user_id THEN
        RAISE EXCEPTION 'Only the recipient can reject this settlement';
    END IF;
    
    -- Check if already processed
    IF settlement_record.status != 'pending' THEN
        RAISE EXCEPTION 'Settlement has already been processed';
    END IF;
    
    -- Reject the settlement
    UPDATE public.settlements
    SET 
        status = 'rejected',
        responded_at = NOW()
    WHERE id = settlement_uuid;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing settlements to be 'approved' (they were already settled)
UPDATE public.settlements 
SET status = 'approved', responded_at = settled_at 
WHERE status IS NULL OR status = 'pending';

ANALYZE public.settlements;

