-- ============================================================================
-- Add indexes for unindexed foreign keys
-- These improve JOIN performance on foreign key columns
-- ============================================================================

-- expense_splits.placeholder_id
CREATE INDEX IF NOT EXISTS idx_expense_splits_placeholder_id 
    ON public.expense_splits(placeholder_id) 
    WHERE placeholder_id IS NOT NULL;

-- expenses.paid_by_placeholder_id  
CREATE INDEX IF NOT EXISTS idx_expenses_paid_by_placeholder_id 
    ON public.expenses(paid_by_placeholder_id) 
    WHERE paid_by_placeholder_id IS NOT NULL;

-- group_invitations.invited_by
CREATE INDEX IF NOT EXISTS idx_group_invitations_invited_by 
    ON public.group_invitations(invited_by);

-- group_members.placeholder_id
CREATE INDEX IF NOT EXISTS idx_group_members_placeholder_id 
    ON public.group_members(placeholder_id) 
    WHERE placeholder_id IS NOT NULL;

