-- ============================================================================
-- Add currency column to groups table
-- ============================================================================

-- Add currency column with default USD
ALTER TABLE public.groups 
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';

-- Update any existing groups without currency to use USD
UPDATE public.groups 
SET currency = 'USD' 
WHERE currency IS NULL;

-- Analyze for query planner
ANALYZE public.groups;

