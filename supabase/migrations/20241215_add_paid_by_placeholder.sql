-- Add paid_by_placeholder_id column to expenses table
-- This allows placeholder members (not yet signed up) to be recorded as the payer

-- Make paid_by nullable (since either paid_by OR paid_by_placeholder_id will be set)
ALTER TABLE expenses 
ALTER COLUMN paid_by DROP NOT NULL;

-- Add the new column for placeholder payers
ALTER TABLE expenses 
ADD COLUMN paid_by_placeholder_id UUID REFERENCES placeholder_members(id) ON DELETE SET NULL;

-- Add constraint: either paid_by or paid_by_placeholder_id must be set (but not both)
ALTER TABLE expenses
ADD CONSTRAINT check_payer_set 
CHECK (
    (paid_by IS NOT NULL AND paid_by_placeholder_id IS NULL) OR
    (paid_by IS NULL AND paid_by_placeholder_id IS NOT NULL)
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_expenses_paid_by_placeholder 
ON expenses(paid_by_placeholder_id) 
WHERE paid_by_placeholder_id IS NOT NULL;

