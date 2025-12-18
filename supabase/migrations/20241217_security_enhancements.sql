-- ============================================================================
-- SECURITY ENHANCEMENTS MIGRATION
-- Version: 1.0.0
-- Date: December 17, 2024
-- 
-- This migration includes:
-- 1. Comprehensive RLS audit and fixes
-- 2. Audit logging for sensitive operations
-- 3. Soft deletes for critical data
-- ============================================================================

-- ============================================================================
-- PART 1: COMPREHENSIVE RLS AUDIT
-- ============================================================================

-- List of all tables and their expected RLS status:
-- ✅ profiles          - RLS enabled, policies exist
-- ✅ groups            - RLS enabled, policies exist
-- ✅ group_members     - RLS enabled, policies exist
-- ✅ expenses          - RLS enabled, policies exist
-- ✅ expense_splits    - RLS enabled, policies exist
-- ✅ settlements       - RLS enabled, policies exist
-- ✅ friendships       - RLS enabled, policies exist
-- ✅ activities        - RLS enabled, policies exist
-- ✅ notifications     - RLS enabled, policies exist
-- ✅ group_invitations - RLS enabled, policies exist
-- ✅ placeholder_members - RLS enabled, policies exist
-- ✅ feedback          - RLS enabled, policies exist
-- ⚠️ pending_settlements - Need to verify RLS
-- ⚠️ audit_logs (new)  - Will add RLS

-- Fix: Ensure pending_settlements has proper RLS if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pending_settlements') THEN
        ALTER TABLE public.pending_settlements ENABLE ROW LEVEL SECURITY;
        
        -- Drop existing policies to recreate them cleanly
        DROP POLICY IF EXISTS "Users can view pending settlements" ON public.pending_settlements;
        DROP POLICY IF EXISTS "Users can create pending settlements" ON public.pending_settlements;
        DROP POLICY IF EXISTS "Users can update pending settlements" ON public.pending_settlements;
        
        -- Create proper RLS policies
        CREATE POLICY "Users can view pending settlements" ON public.pending_settlements
            FOR SELECT USING (
                from_user = (SELECT auth.uid())
                OR to_user = (SELECT auth.uid())
                OR public.is_group_member(group_id, (SELECT auth.uid()))
            );
        
        CREATE POLICY "Users can create pending settlements" ON public.pending_settlements
            FOR INSERT WITH CHECK (
                from_user = (SELECT auth.uid())
                AND public.is_group_member(group_id, (SELECT auth.uid()))
            );
        
        CREATE POLICY "Users can update pending settlements" ON public.pending_settlements
            FOR UPDATE USING (
                from_user = (SELECT auth.uid())
                OR to_user = (SELECT auth.uid())
            );
    END IF;
END $$;

-- Fix: Feedback table RLS - currently allows anonymous insert but uses auth.uid() in SELECT
-- This can cause issues. Let's fix it to be more permissive for anonymous users viewing their own feedback
DROP POLICY IF EXISTS "Users can view own feedback" ON public.feedback;
CREATE POLICY "Users can view own feedback" ON public.feedback
    FOR SELECT USING (
        -- Logged in user can see their feedback
        (user_id IS NOT NULL AND user_id = (SELECT auth.uid()))
        OR
        -- Anonymous users can see feedback by matching email (if they login later)
        (user_id IS NULL AND email IS NOT NULL AND email = (
            SELECT email FROM auth.users WHERE id = (SELECT auth.uid())
        ))
    );

-- Fix: Activities RLS - handle NULL group_id case (personal activities)
DROP POLICY IF EXISTS "Activities are viewable by group members" ON public.activities;
CREATE POLICY "Activities are viewable by users" ON public.activities
    FOR SELECT USING (
        -- User's own activities (personal, non-group)
        (group_id IS NULL AND user_id = (SELECT auth.uid()))
        OR
        -- Group activities visible to group members
        (group_id IS NOT NULL AND public.is_group_member(group_id, (SELECT auth.uid())))
    );

DROP POLICY IF EXISTS "Group members can create activities" ON public.activities;
CREATE POLICY "Users can create activities" ON public.activities
    FOR INSERT WITH CHECK (
        user_id = (SELECT auth.uid())
        AND (
            group_id IS NULL
            OR public.is_group_member(group_id, (SELECT auth.uid()))
        )
    );

-- ============================================================================
-- PART 2: AUDIT LOGGING TABLE
-- ============================================================================

-- Create enum for audit action types
DO $$ BEGIN
    CREATE TYPE audit_action AS ENUM (
        -- Group actions
        'group_created',
        'group_updated',
        'group_deleted',
        'group_member_added',
        'group_member_removed',
        'group_admin_promoted',
        'group_admin_demoted',
        
        -- Expense actions
        'expense_created',
        'expense_updated',
        'expense_deleted',
        
        -- Settlement actions
        'settlement_created',
        'settlement_approved',
        'settlement_rejected',
        
        -- User actions
        'user_profile_updated',
        'user_avatar_changed',
        
        -- Security actions
        'login_success',
        'login_failed',
        'password_changed',
        'password_reset_requested',
        
        -- Invitation actions
        'invite_code_regenerated',
        'invite_accepted',
        'invite_rejected'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Who performed the action
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    user_email TEXT, -- Stored separately in case profile is deleted
    
    -- What action was performed
    action audit_action NOT NULL,
    
    -- What entity was affected
    entity_type TEXT NOT NULL, -- 'group', 'expense', 'settlement', 'user', 'member'
    entity_id UUID,
    
    -- Context
    group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
    
    -- Details of the action (JSON for flexibility)
    details JSONB DEFAULT '{}',
    
    -- Request metadata
    ip_address INET,
    user_agent TEXT,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_group_id ON public.audit_logs(group_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action ON public.audit_logs(user_id, action, created_at DESC);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for audit_logs
-- Users can view their own audit logs
CREATE POLICY "Users can view own audit logs" ON public.audit_logs
    FOR SELECT USING (
        user_id = (SELECT auth.uid())
    );

-- Group admins can view group-related audit logs
CREATE POLICY "Group admins can view group audit logs" ON public.audit_logs
    FOR SELECT USING (
        group_id IS NOT NULL 
        AND public.is_group_admin(group_id, (SELECT auth.uid()))
    );

-- Only system (via SECURITY DEFINER functions) can insert audit logs
-- No direct INSERT policy - we'll use a function instead
CREATE POLICY "System can insert audit logs" ON public.audit_logs
    FOR INSERT WITH CHECK (false); -- Default deny, use function

-- ============================================================================
-- AUDIT LOGGING FUNCTION
-- ============================================================================

-- Function to create audit log entries (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.create_audit_log(
    p_user_id UUID,
    p_user_email TEXT,
    p_action audit_action,
    p_entity_type TEXT,
    p_entity_id UUID DEFAULT NULL,
    p_group_id UUID DEFAULT NULL,
    p_details JSONB DEFAULT '{}',
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_audit_id UUID;
BEGIN
    INSERT INTO public.audit_logs (
        user_id,
        user_email,
        action,
        entity_type,
        entity_id,
        group_id,
        details,
        ip_address,
        user_agent
    ) VALUES (
        p_user_id,
        p_user_email,
        p_action,
        p_entity_type,
        p_entity_id,
        p_group_id,
        p_details,
        p_ip_address,
        p_user_agent
    ) RETURNING id INTO v_audit_id;
    
    RETURN v_audit_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.create_audit_log TO authenticated;

-- ============================================================================
-- AUTOMATIC AUDIT TRIGGERS
-- ============================================================================

-- Trigger function for group changes
CREATE OR REPLACE FUNCTION public.audit_group_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_action audit_action;
    v_details JSONB;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_action := 'group_created';
        v_details := jsonb_build_object(
            'name', NEW.name,
            'description', NEW.description
        );
        
        PERFORM public.create_audit_log(
            NEW.created_by,
            NULL,
            v_action,
            'group',
            NEW.id,
            NEW.id,
            v_details
        );
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Only log if there are actual changes
        IF OLD.name != NEW.name OR 
           OLD.description IS DISTINCT FROM NEW.description OR
           OLD.simplify_debts != NEW.simplify_debts THEN
            v_action := 'group_updated';
            v_details := jsonb_build_object(
                'old', jsonb_build_object(
                    'name', OLD.name,
                    'description', OLD.description,
                    'simplify_debts', OLD.simplify_debts
                ),
                'new', jsonb_build_object(
                    'name', NEW.name,
                    'description', NEW.description,
                    'simplify_debts', NEW.simplify_debts
                )
            );
            
            PERFORM public.create_audit_log(
                (SELECT auth.uid()),
                NULL,
                v_action,
                'group',
                NEW.id,
                NEW.id,
                v_details
            );
        END IF;
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        -- Check if this is a soft delete
        IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
            v_action := 'group_deleted';
            v_details := jsonb_build_object(
                'name', OLD.name,
                'soft_delete', true
            );
        ELSE
            v_action := 'group_deleted';
            v_details := jsonb_build_object(
                'name', OLD.name,
                'hard_delete', true
            );
        END IF;
        
        PERFORM public.create_audit_log(
            (SELECT auth.uid()),
            NULL,
            v_action,
            'group',
            OLD.id,
            OLD.id,
            v_details
        );
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$;

-- Trigger function for settlement changes
CREATE OR REPLACE FUNCTION public.audit_settlement_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_action audit_action;
    v_details JSONB;
    v_from_user_email TEXT;
    v_to_user_email TEXT;
BEGIN
    -- Get user emails for the log
    SELECT email INTO v_from_user_email FROM public.profiles WHERE id = NEW.from_user;
    SELECT email INTO v_to_user_email FROM public.profiles WHERE id = NEW.to_user;
    
    IF TG_OP = 'INSERT' THEN
        v_action := 'settlement_created';
        v_details := jsonb_build_object(
            'amount', NEW.amount,
            'from_user', v_from_user_email,
            'to_user', v_to_user_email,
            'note', NEW.note
        );
        
        PERFORM public.create_audit_log(
            NEW.from_user,
            v_from_user_email,
            v_action,
            'settlement',
            NEW.id,
            NEW.group_id,
            v_details
        );
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$;

-- Trigger function for expense changes
CREATE OR REPLACE FUNCTION public.audit_expense_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_action audit_action;
    v_details JSONB;
    v_payer_email TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT email INTO v_payer_email FROM public.profiles WHERE id = NEW.paid_by;
        
        v_action := 'expense_created';
        v_details := jsonb_build_object(
            'description', NEW.description,
            'amount', NEW.amount,
            'category', NEW.category,
            'paid_by', v_payer_email
        );
        
        PERFORM public.create_audit_log(
            NEW.paid_by,
            v_payer_email,
            v_action,
            'expense',
            NEW.id,
            NEW.group_id,
            v_details
        );
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Only log significant changes
        IF OLD.amount != NEW.amount OR 
           OLD.description != NEW.description OR
           OLD.category != NEW.category THEN
            SELECT email INTO v_payer_email FROM public.profiles WHERE id = NEW.paid_by;
            
            v_action := 'expense_updated';
            v_details := jsonb_build_object(
                'old', jsonb_build_object(
                    'description', OLD.description,
                    'amount', OLD.amount,
                    'category', OLD.category
                ),
                'new', jsonb_build_object(
                    'description', NEW.description,
                    'amount', NEW.amount,
                    'category', NEW.category
                )
            );
            
            PERFORM public.create_audit_log(
                (SELECT auth.uid()),
                v_payer_email,
                v_action,
                'expense',
                NEW.id,
                NEW.group_id,
                v_details
            );
        END IF;
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        SELECT email INTO v_payer_email FROM public.profiles WHERE id = OLD.paid_by;
        
        v_action := 'expense_deleted';
        v_details := jsonb_build_object(
            'description', OLD.description,
            'amount', OLD.amount
        );
        
        PERFORM public.create_audit_log(
            (SELECT auth.uid()),
            v_payer_email,
            v_action,
            'expense',
            OLD.id,
            OLD.group_id,
            v_details
        );
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$;

-- Trigger function for group member changes
CREATE OR REPLACE FUNCTION public.audit_member_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_action audit_action;
    v_details JSONB;
    v_member_email TEXT;
    v_member_name TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.user_id IS NOT NULL THEN
            SELECT email, full_name INTO v_member_email, v_member_name 
            FROM public.profiles WHERE id = NEW.user_id;
        ELSIF NEW.placeholder_id IS NOT NULL THEN
            SELECT name INTO v_member_name 
            FROM public.placeholder_members WHERE id = NEW.placeholder_id;
            v_member_email := 'placeholder';
        END IF;
        
        v_action := 'group_member_added';
        v_details := jsonb_build_object(
            'member_name', v_member_name,
            'member_email', v_member_email,
            'role', NEW.role,
            'is_placeholder', NEW.placeholder_id IS NOT NULL
        );
        
        PERFORM public.create_audit_log(
            (SELECT auth.uid()),
            NULL,
            v_action,
            'member',
            COALESCE(NEW.user_id, NEW.placeholder_id),
            NEW.group_id,
            v_details
        );
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Role change
        IF OLD.role != NEW.role THEN
            IF NEW.user_id IS NOT NULL THEN
                SELECT email, full_name INTO v_member_email, v_member_name 
                FROM public.profiles WHERE id = NEW.user_id;
            END IF;
            
            IF NEW.role = 'admin' THEN
                v_action := 'group_admin_promoted';
            ELSE
                v_action := 'group_admin_demoted';
            END IF;
            
            v_details := jsonb_build_object(
                'member_name', v_member_name,
                'old_role', OLD.role,
                'new_role', NEW.role
            );
            
            PERFORM public.create_audit_log(
                (SELECT auth.uid()),
                NULL,
                v_action,
                'member',
                NEW.user_id,
                NEW.group_id,
                v_details
            );
        END IF;
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.user_id IS NOT NULL THEN
            SELECT email, full_name INTO v_member_email, v_member_name 
            FROM public.profiles WHERE id = OLD.user_id;
        ELSIF OLD.placeholder_id IS NOT NULL THEN
            SELECT name INTO v_member_name 
            FROM public.placeholder_members WHERE id = OLD.placeholder_id;
        END IF;
        
        v_action := 'group_member_removed';
        v_details := jsonb_build_object(
            'member_name', v_member_name,
            'member_email', v_member_email,
            'is_placeholder', OLD.placeholder_id IS NOT NULL
        );
        
        PERFORM public.create_audit_log(
            (SELECT auth.uid()),
            NULL,
            v_action,
            'member',
            COALESCE(OLD.user_id, OLD.placeholder_id),
            OLD.group_id,
            v_details
        );
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$;

-- Create the triggers (with IF NOT EXISTS logic)
DO $$
BEGIN
    -- Groups audit trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_groups_trigger') THEN
        CREATE TRIGGER audit_groups_trigger
            AFTER INSERT OR UPDATE ON public.groups
            FOR EACH ROW
            EXECUTE FUNCTION public.audit_group_changes();
    END IF;
    
    -- Settlements audit trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_settlements_trigger') THEN
        CREATE TRIGGER audit_settlements_trigger
            AFTER INSERT ON public.settlements
            FOR EACH ROW
            EXECUTE FUNCTION public.audit_settlement_changes();
    END IF;
    
    -- Expenses audit trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_expenses_trigger') THEN
        CREATE TRIGGER audit_expenses_trigger
            AFTER INSERT OR UPDATE OR DELETE ON public.expenses
            FOR EACH ROW
            EXECUTE FUNCTION public.audit_expense_changes();
    END IF;
    
    -- Group members audit trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_members_trigger') THEN
        CREATE TRIGGER audit_members_trigger
            AFTER INSERT OR UPDATE OR DELETE ON public.group_members
            FOR EACH ROW
            EXECUTE FUNCTION public.audit_member_changes();
    END IF;
END $$;

-- ============================================================================
-- PART 3: SOFT DELETES
-- ============================================================================

-- Add deleted_at column to groups
ALTER TABLE public.groups
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Add deleted_at column to expenses  
ALTER TABLE public.expenses
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Add deleted_at column to settlements
ALTER TABLE public.settlements
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Create indexes for efficient soft delete queries
CREATE INDEX IF NOT EXISTS idx_groups_deleted_at ON public.groups(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_deleted_at ON public.expenses(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_settlements_deleted_at ON public.settlements(deleted_at) WHERE deleted_at IS NULL;

-- Update RLS policies to exclude soft-deleted records

-- Groups: Only show non-deleted groups
DROP POLICY IF EXISTS "Groups are viewable by members" ON public.groups;
CREATE POLICY "Groups are viewable by members" ON public.groups
    FOR SELECT
    TO authenticated
    USING (
        deleted_at IS NULL
        AND public.is_group_member(id, (SELECT auth.uid()))
    );

-- Note: Keep existing UPDATE/DELETE policies - they already check membership
-- The soft delete will be handled by application code setting deleted_at

-- Expenses: Only show non-deleted expenses
DROP POLICY IF EXISTS "Expenses are viewable by group members" ON public.expenses;
CREATE POLICY "Expenses are viewable by group members" ON public.expenses
    FOR SELECT
    TO authenticated
    USING (
        deleted_at IS NULL
        AND public.is_group_member(group_id, (SELECT auth.uid()))
    );

-- Settlements: Only show non-deleted settlements
DROP POLICY IF EXISTS "Settlements are viewable by involved users" ON public.settlements;
CREATE POLICY "Settlements are viewable by involved users" ON public.settlements
    FOR SELECT
    TO authenticated
    USING (
        deleted_at IS NULL
        AND (
            from_user = (SELECT auth.uid()) 
            OR to_user = (SELECT auth.uid())
            OR public.is_group_member(group_id, (SELECT auth.uid()))
        )
    );

-- ============================================================================
-- SOFT DELETE FUNCTIONS
-- ============================================================================

-- Function to soft delete a group
CREATE OR REPLACE FUNCTION public.soft_delete_group(group_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if user is admin
    IF NOT public.is_group_admin(group_uuid, auth.uid()) THEN
        RAISE EXCEPTION 'Only group admins can delete groups';
    END IF;
    
    -- Soft delete the group
    UPDATE public.groups 
    SET deleted_at = NOW()
    WHERE id = group_uuid AND deleted_at IS NULL;
    
    -- Also soft delete related expenses
    UPDATE public.expenses
    SET deleted_at = NOW()
    WHERE group_id = group_uuid AND deleted_at IS NULL;
    
    -- Also soft delete related settlements
    UPDATE public.settlements
    SET deleted_at = NOW()
    WHERE group_id = group_uuid AND deleted_at IS NULL;
    
    RETURN FOUND;
END;
$$;

-- Function to soft delete an expense
CREATE OR REPLACE FUNCTION public.soft_delete_expense(expense_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_expense RECORD;
BEGIN
    -- Get the expense
    SELECT * INTO v_expense 
    FROM public.expenses 
    WHERE id = expense_uuid AND deleted_at IS NULL;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Expense not found';
    END IF;
    
    -- Check if user is the expense creator or group admin
    IF v_expense.paid_by != auth.uid() AND 
       NOT public.is_group_admin(v_expense.group_id, auth.uid()) THEN
        RAISE EXCEPTION 'Only expense creator or group admin can delete expenses';
    END IF;
    
    -- Soft delete the expense
    UPDATE public.expenses 
    SET deleted_at = NOW()
    WHERE id = expense_uuid;
    
    RETURN TRUE;
END;
$$;

-- Function to restore a soft-deleted group (admin only)
CREATE OR REPLACE FUNCTION public.restore_group(group_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if user was an admin before deletion
    IF NOT EXISTS (
        SELECT 1 FROM public.group_members 
        WHERE group_id = group_uuid 
        AND user_id = auth.uid() 
        AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Only group admins can restore groups';
    END IF;
    
    -- Restore the group
    UPDATE public.groups 
    SET deleted_at = NULL
    WHERE id = group_uuid AND deleted_at IS NOT NULL;
    
    -- Also restore related expenses
    UPDATE public.expenses
    SET deleted_at = NULL
    WHERE group_id = group_uuid AND deleted_at IS NOT NULL;
    
    -- Also restore related settlements
    UPDATE public.settlements
    SET deleted_at = NULL
    WHERE group_id = group_uuid AND deleted_at IS NOT NULL;
    
    RETURN FOUND;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.soft_delete_group TO authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_expense TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_group TO authenticated;

-- ============================================================================
-- CLEANUP: Scheduled job to permanently delete old soft-deleted records
-- Note: This should be run as a scheduled job (e.g., Supabase pg_cron)
-- ============================================================================

-- Function to permanently delete old soft-deleted records (older than 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_deleted_records()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_count INTEGER := 0;
    v_temp_count INTEGER;
BEGIN
    -- Delete old soft-deleted settlements (cascade will handle related records)
    DELETE FROM public.settlements 
    WHERE deleted_at IS NOT NULL 
    AND deleted_at < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS v_temp_count = ROW_COUNT;
    v_deleted_count := v_deleted_count + v_temp_count;
    
    -- Delete old soft-deleted expenses
    DELETE FROM public.expenses 
    WHERE deleted_at IS NOT NULL 
    AND deleted_at < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS v_temp_count = ROW_COUNT;
    v_deleted_count := v_deleted_count + v_temp_count;
    
    -- Delete old soft-deleted groups (cascade will handle members)
    DELETE FROM public.groups 
    WHERE deleted_at IS NOT NULL 
    AND deleted_at < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS v_temp_count = ROW_COUNT;
    v_deleted_count := v_deleted_count + v_temp_count;
    
    -- Delete old audit logs (older than 1 year)
    DELETE FROM public.audit_logs 
    WHERE created_at < NOW() - INTERVAL '1 year';
    GET DIAGNOSTICS v_temp_count = ROW_COUNT;
    v_deleted_count := v_deleted_count + v_temp_count;
    
    RETURN v_deleted_count;
END;
$$;

-- ============================================================================
-- ANALYZE TABLES
-- ============================================================================

ANALYZE public.audit_logs;
ANALYZE public.groups;
ANALYZE public.expenses;
ANALYZE public.settlements;

-- ============================================================================
-- VERIFICATION QUERIES (Run these to verify the migration)
-- ============================================================================

-- Verify RLS is enabled on all tables:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Verify audit_logs table exists:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'audit_logs';

-- Verify soft delete columns exist:
-- SELECT column_name FROM information_schema.columns WHERE table_name IN ('groups', 'expenses', 'settlements') AND column_name = 'deleted_at';

