-- ============================================================================
-- FIX: Balance calculation for placeholder payers
-- 
-- ISSUE: The performance_indexes migration overwrote the correct function
-- that handles placeholder members (like Sparsh who hasn't signed up).
-- 
-- CALCULATION LOGIC:
-- balance = total_paid - total_owed + settled_out - settled_in
-- 
-- - total_paid: How much this person paid for expenses
-- - total_owed: How much this person's share is (from expense_splits)
-- - Positive balance = others owe you money
-- - Negative balance = you owe others money
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_group_balances(group_uuid UUID)
RETURNS TABLE (
    user_id UUID,
    user_name TEXT,
    balance DECIMAL(12, 2),
    is_placeholder BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    WITH 
    -- Amount each REAL USER paid
    paid_users AS (
        SELECT 
            e.paid_by as uid,
            COALESCE(SUM(e.amount), 0) as total_paid
        FROM public.expenses e
        WHERE e.group_id = group_uuid
        AND e.paid_by IS NOT NULL
        GROUP BY e.paid_by
    ),
    -- Amount each PLACEHOLDER paid
    paid_placeholders AS (
        SELECT 
            e.paid_by_placeholder_id as pid,
            COALESCE(SUM(e.amount), 0) as total_paid
        FROM public.expenses e
        WHERE e.group_id = group_uuid
        AND e.paid_by_placeholder_id IS NOT NULL
        GROUP BY e.paid_by_placeholder_id
    ),
    -- Amount each REAL USER owes (from expense_splits)
    owed_users AS (
        SELECT 
            es.user_id as uid,
            COALESCE(SUM(es.amount), 0) as total_owed
        FROM public.expense_splits es
        INNER JOIN public.expenses e ON e.id = es.expense_id
        WHERE e.group_id = group_uuid 
        AND es.is_settled = FALSE
        AND es.user_id IS NOT NULL
        GROUP BY es.user_id
    ),
    -- Amount each PLACEHOLDER owes (from expense_splits)
    owed_placeholders AS (
        SELECT 
            es.placeholder_id as pid,
            COALESCE(SUM(es.amount), 0) as total_owed
        FROM public.expense_splits es
        INNER JOIN public.expenses e ON e.id = es.expense_id
        WHERE e.group_id = group_uuid 
        AND es.is_settled = FALSE
        AND es.placeholder_id IS NOT NULL
        GROUP BY es.placeholder_id
    ),
    -- Amount settled OUT by real users (they paid someone back)
    settled_out AS (
        SELECT 
            s.from_user as uid,
            COALESCE(SUM(s.amount), 0) as total_out
        FROM public.settlements s
        WHERE s.group_id = group_uuid
        AND s.from_user IS NOT NULL
        GROUP BY s.from_user
    ),
    -- Amount settled IN to real users (someone paid them back)
    settled_in AS (
        SELECT 
            s.to_user as uid,
            COALESCE(SUM(s.amount), 0) as total_in
        FROM public.settlements s
        WHERE s.group_id = group_uuid
        AND s.to_user IS NOT NULL
        GROUP BY s.to_user
    ),
    -- Amount settled OUT by placeholders
    settled_out_placeholders AS (
        SELECT 
            s.from_placeholder_id as pid,
            COALESCE(SUM(s.amount), 0) as total_out
        FROM public.settlements s
        WHERE s.group_id = group_uuid
        AND s.from_placeholder_id IS NOT NULL
        GROUP BY s.from_placeholder_id
    ),
    -- Amount settled IN to placeholders
    settled_in_placeholders AS (
        SELECT 
            s.to_placeholder_id as pid,
            COALESCE(SUM(s.amount), 0) as total_in
        FROM public.settlements s
        WHERE s.group_id = group_uuid
        AND s.to_placeholder_id IS NOT NULL
        GROUP BY s.to_placeholder_id
    )
    -- Real users balance
    SELECT 
        gm.user_id,
        COALESCE(p.full_name, p.email) as user_name,
        (
            COALESCE(paid_users.total_paid, 0) 
            - COALESCE(owed_users.total_owed, 0) 
            + COALESCE(settled_out.total_out, 0) 
            - COALESCE(settled_in.total_in, 0)
        )::DECIMAL(12, 2) as balance,
        FALSE as is_placeholder
    FROM public.group_members gm
    INNER JOIN public.profiles p ON p.id = gm.user_id
    LEFT JOIN paid_users ON paid_users.uid = gm.user_id
    LEFT JOIN owed_users ON owed_users.uid = gm.user_id
    LEFT JOIN settled_out ON settled_out.uid = gm.user_id
    LEFT JOIN settled_in ON settled_in.uid = gm.user_id
    WHERE gm.group_id = group_uuid
    AND gm.user_id IS NOT NULL
    
    UNION ALL
    
    -- Placeholder members balance
    SELECT 
        gm.placeholder_id as user_id,
        pm.name as user_name,
        (
            COALESCE(paid_placeholders.total_paid, 0) 
            - COALESCE(owed_placeholders.total_owed, 0)
            + COALESCE(settled_out_placeholders.total_out, 0)
            - COALESCE(settled_in_placeholders.total_in, 0)
        )::DECIMAL(12, 2) as balance,
        TRUE as is_placeholder
    FROM public.group_members gm
    INNER JOIN public.placeholder_members pm ON pm.id = gm.placeholder_id
    LEFT JOIN paid_placeholders ON paid_placeholders.pid = gm.placeholder_id
    LEFT JOIN owed_placeholders ON owed_placeholders.pid = gm.placeholder_id
    LEFT JOIN settled_out_placeholders ON settled_out_placeholders.pid = gm.placeholder_id
    LEFT JOIN settled_in_placeholders ON settled_in_placeholders.pid = gm.placeholder_id
    WHERE gm.group_id = group_uuid
    AND gm.placeholder_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Add helpful comment
COMMENT ON FUNCTION public.get_group_balances(UUID) IS 
'Calculates balance for all members (real users + placeholders) in a group.
Positive balance = others owe you money.
Negative balance = you owe others money.
Accounts for: expenses paid, splits owed, and settlements.';

