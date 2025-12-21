-- ============================================================================
-- FIX: get_group_balances - Only count APPROVED settlements
-- Issue: Balance calculation was including pending/rejected settlements
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
    -- Amount each REAL USER paid (for expenses)
    paid_users AS (
        SELECT 
            e.paid_by as uid,
            COALESCE(SUM(e.amount), 0) as total_paid
        FROM public.expenses e
        WHERE e.group_id = group_uuid
        AND e.paid_by IS NOT NULL
        GROUP BY e.paid_by
    ),
    -- Amount each PLACEHOLDER paid (for expenses)
    paid_placeholders AS (
        SELECT 
            e.paid_by_placeholder_id as pid,
            COALESCE(SUM(e.amount), 0) as total_paid
        FROM public.expenses e
        WHERE e.group_id = group_uuid
        AND e.paid_by_placeholder_id IS NOT NULL
        GROUP BY e.paid_by_placeholder_id
    ),
    -- Amount each REAL USER owes (from expense_splits where NOT settled)
    owed_users AS (
        SELECT 
            es.user_id as uid,
            COALESCE(SUM(es.amount), 0) as total_owed
        FROM public.expense_splits es
        INNER JOIN public.expenses e ON e.id = es.expense_id
        WHERE e.group_id = group_uuid 
        AND (es.is_settled IS NULL OR es.is_settled = FALSE)
        AND es.user_id IS NOT NULL
        GROUP BY es.user_id
    ),
    -- Amount each PLACEHOLDER owes (from expense_splits where NOT settled)
    owed_placeholders AS (
        SELECT 
            es.placeholder_id as pid,
            COALESCE(SUM(es.amount), 0) as total_owed
        FROM public.expense_splits es
        INNER JOIN public.expenses e ON e.id = es.expense_id
        WHERE e.group_id = group_uuid 
        AND (es.is_settled IS NULL OR es.is_settled = FALSE)
        AND es.placeholder_id IS NOT NULL
        GROUP BY es.placeholder_id
    ),
    -- Amount settled OUT by real users (APPROVED settlements only)
    -- When you pay someone back, your debt decreases (balance goes up)
    settled_out AS (
        SELECT 
            s.from_user as uid,
            COALESCE(SUM(s.amount), 0) as total_out
        FROM public.settlements s
        WHERE s.group_id = group_uuid
        AND s.from_user IS NOT NULL
        AND s.status = 'approved'  -- ONLY approved settlements
        GROUP BY s.from_user
    ),
    -- Amount settled IN to real users (APPROVED settlements only)
    -- When someone pays you back, what they owed you decreases (your balance goes down)
    settled_in AS (
        SELECT 
            s.to_user as uid,
            COALESCE(SUM(s.amount), 0) as total_in
        FROM public.settlements s
        WHERE s.group_id = group_uuid
        AND s.to_user IS NOT NULL
        AND s.status = 'approved'  -- ONLY approved settlements
        GROUP BY s.to_user
    ),
    -- Amount settled OUT by placeholders (APPROVED only)
    settled_out_placeholders AS (
        SELECT 
            s.from_placeholder_id as pid,
            COALESCE(SUM(s.amount), 0) as total_out
        FROM public.settlements s
        WHERE s.group_id = group_uuid
        AND s.from_placeholder_id IS NOT NULL
        AND s.status = 'approved'  -- ONLY approved settlements
        GROUP BY s.from_placeholder_id
    ),
    -- Amount settled IN to placeholders (APPROVED only)
    settled_in_placeholders AS (
        SELECT 
            s.to_placeholder_id as pid,
            COALESCE(SUM(s.amount), 0) as total_in
        FROM public.settlements s
        WHERE s.group_id = group_uuid
        AND s.to_placeholder_id IS NOT NULL
        AND s.status = 'approved'  -- ONLY approved settlements
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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = '';

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_group_balances(UUID) TO authenticated;

-- Update comment
COMMENT ON FUNCTION public.get_group_balances(UUID) IS 
'Calculates balance for all members (real users + placeholders) in a group.
Positive balance = others owe you money.
Negative balance = you owe others money.
Only counts APPROVED settlements. Pending settlements do not affect balance.';

