-- ============================================================================
-- Fix Security Warnings: Set search_path for all functions
-- This prevents potential search_path injection attacks
-- ============================================================================

-- Drop functions that need return type changes first
DROP FUNCTION IF EXISTS public.link_placeholder_to_user(UUID, UUID);

-- Fix is_group_member function
CREATE OR REPLACE FUNCTION public.is_group_member(group_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = group_uuid AND user_id = user_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix is_group_admin function
CREATE OR REPLACE FUNCTION public.is_group_admin(group_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = group_uuid AND user_id = user_uuid AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix link_placeholder_to_user function
CREATE OR REPLACE FUNCTION public.link_placeholder_to_user(
    placeholder_uuid UUID,
    user_uuid UUID
)
RETURNS VOID AS $$
BEGIN
    -- Update group_members: replace placeholder with real user
    UPDATE public.group_members
    SET user_id = user_uuid, placeholder_id = NULL
    WHERE placeholder_id = placeholder_uuid;

    -- Update expense_splits: replace placeholder with real user
    UPDATE public.expense_splits
    SET user_id = user_uuid, placeholder_id = NULL
    WHERE placeholder_id = placeholder_uuid;

    -- Delete the placeholder
    DELETE FROM public.placeholder_members WHERE id = placeholder_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix get_group_balances function
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
    -- Amount each real user paid
    paid_users AS (
        SELECT 
            e.paid_by as uid,
            COALESCE(SUM(e.amount), 0) as total_paid
        FROM public.expenses e
        WHERE e.group_id = group_uuid
        AND e.paid_by IS NOT NULL
        GROUP BY e.paid_by
    ),
    -- Amount each placeholder paid
    paid_placeholders AS (
        SELECT 
            e.paid_by_placeholder_id as pid,
            COALESCE(SUM(e.amount), 0) as total_paid
        FROM public.expenses e
        WHERE e.group_id = group_uuid
        AND e.paid_by_placeholder_id IS NOT NULL
        GROUP BY e.paid_by_placeholder_id
    ),
    -- Amount each real user owes (from expense_splits with user_id)
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
    -- Amount each placeholder owes
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
    -- Amount settled out by real users
    settled_out AS (
        SELECT 
            s.from_user as uid,
            COALESCE(SUM(s.amount), 0) as total_out
        FROM public.settlements s
        WHERE s.group_id = group_uuid
        GROUP BY s.from_user
    ),
    -- Amount settled in to real users
    settled_in AS (
        SELECT 
            s.to_user as uid,
            COALESCE(SUM(s.amount), 0) as total_in
        FROM public.settlements s
        WHERE s.group_id = group_uuid
        GROUP BY s.to_user
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
        )::DECIMAL(12, 2) as balance,
        TRUE as is_placeholder
    FROM public.group_members gm
    INNER JOIN public.placeholder_members pm ON pm.id = gm.placeholder_id
    LEFT JOIN paid_placeholders ON paid_placeholders.pid = gm.placeholder_id
    LEFT JOIN owed_placeholders ON owed_placeholders.pid = gm.placeholder_id
    WHERE gm.group_id = group_uuid
    AND gm.placeholder_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Fix handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

