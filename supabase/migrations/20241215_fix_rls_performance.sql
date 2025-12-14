-- ============================================================================
-- Fix RLS Performance Warnings
-- Replace auth.uid() with (select auth.uid()) to prevent re-evaluation per row
-- Also fix duplicate policies and indexes
-- ============================================================================

-- ============================================================================
-- 1. DROP DUPLICATE INDEXES
-- ============================================================================

DROP INDEX IF EXISTS public.idx_expense_splits_expense;
DROP INDEX IF EXISTS public.idx_expense_splits_user;
DROP INDEX IF EXISTS public.idx_expense_splits_unsettled;
DROP INDEX IF EXISTS public.idx_expenses_created_at;
DROP INDEX IF EXISTS public.idx_settlements_group;

-- Keep: idx_expense_splits_expense_id, idx_expense_splits_user_id, 
--       idx_expense_splits_user_unsettled, idx_expenses_created_at_desc, idx_settlements_group_id

-- ============================================================================
-- 2. FIX DUPLICATE PERMISSIVE POLICIES
-- ============================================================================

-- group_members: Remove duplicate INSERT policy
DROP POLICY IF EXISTS "Authenticated users can add members" ON public.group_members;

-- settlements: Remove duplicate INSERT policy  
DROP POLICY IF EXISTS "Users can create settlements they're involved in" ON public.settlements;

-- ============================================================================
-- 3. FIX RLS POLICIES - profiles table
-- ============================================================================

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK ((select auth.uid()) = id);

-- ============================================================================
-- 4. FIX RLS POLICIES - groups table
-- ============================================================================

DROP POLICY IF EXISTS "Creators can update their groups" ON public.groups;
CREATE POLICY "Creators can update their groups" ON public.groups
    FOR UPDATE USING ((select auth.uid()) = created_by);

DROP POLICY IF EXISTS "Creators can delete their groups" ON public.groups;
CREATE POLICY "Creators can delete their groups" ON public.groups
    FOR DELETE USING ((select auth.uid()) = created_by);

DROP POLICY IF EXISTS "Authenticated users can create groups" ON public.groups;
CREATE POLICY "Authenticated users can create groups" ON public.groups
    FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

-- ============================================================================
-- 5. FIX RLS POLICIES - group_members table
-- ============================================================================

DROP POLICY IF EXISTS "Members can be removed" ON public.group_members;
CREATE POLICY "Members can be removed" ON public.group_members
    FOR DELETE USING (
        is_group_admin(group_id, (select auth.uid()))
        OR user_id = (select auth.uid())
    );

DROP POLICY IF EXISTS "Admins can add members or first member" ON public.group_members;
CREATE POLICY "Admins can add members or first member" ON public.group_members
    FOR INSERT WITH CHECK (
        is_group_admin(group_id, (select auth.uid()))
        OR NOT EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_members.group_id)
    );

-- ============================================================================
-- 6. FIX RLS POLICIES - expenses table
-- ============================================================================

DROP POLICY IF EXISTS "Expenses are viewable by group members" ON public.expenses;
CREATE POLICY "Expenses are viewable by group members" ON public.expenses
    FOR SELECT USING (is_group_member(group_id, (select auth.uid())));

DROP POLICY IF EXISTS "Group members can create expenses" ON public.expenses;
CREATE POLICY "Group members can create expenses" ON public.expenses
    FOR INSERT WITH CHECK (is_group_member(group_id, (select auth.uid())));

DROP POLICY IF EXISTS "Expense creator can update" ON public.expenses;
CREATE POLICY "Expense creator can update" ON public.expenses
    FOR UPDATE USING (paid_by = (select auth.uid()));

DROP POLICY IF EXISTS "Expense creator can delete" ON public.expenses;
CREATE POLICY "Expense creator can delete" ON public.expenses
    FOR DELETE USING (paid_by = (select auth.uid()));

-- ============================================================================
-- 7. FIX RLS POLICIES - expense_splits table
-- ============================================================================

DROP POLICY IF EXISTS "Expense splits are viewable by group members" ON public.expense_splits;
CREATE POLICY "Expense splits are viewable by group members" ON public.expense_splits
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.expenses e 
            WHERE e.id = expense_id 
            AND is_group_member(e.group_id, (select auth.uid()))
        )
    );

DROP POLICY IF EXISTS "Group members can create expense splits" ON public.expense_splits;
CREATE POLICY "Group members can create expense splits" ON public.expense_splits
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.expenses e 
            WHERE e.id = expense_id 
            AND is_group_member(e.group_id, (select auth.uid()))
        )
    );

DROP POLICY IF EXISTS "Expense creator can update splits" ON public.expense_splits;
CREATE POLICY "Expense creator can update splits" ON public.expense_splits
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.expenses e 
            WHERE e.id = expense_id 
            AND e.paid_by = (select auth.uid())
        )
    );

DROP POLICY IF EXISTS "Expense creator can delete splits" ON public.expense_splits;
CREATE POLICY "Expense creator can delete splits" ON public.expense_splits
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.expenses e 
            WHERE e.id = expense_id 
            AND e.paid_by = (select auth.uid())
        )
    );

-- ============================================================================
-- 8. FIX RLS POLICIES - placeholder_members table
-- ============================================================================

DROP POLICY IF EXISTS "Group members can view placeholders" ON public.placeholder_members;
CREATE POLICY "Group members can view placeholders" ON public.placeholder_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.group_members gm 
            WHERE gm.placeholder_id = id 
            AND is_group_member(gm.group_id, (select auth.uid()))
        )
    );

DROP POLICY IF EXISTS "Group admins can create placeholders" ON public.placeholder_members;
CREATE POLICY "Group admins can create placeholders" ON public.placeholder_members
    FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Creators can update placeholders" ON public.placeholder_members;
CREATE POLICY "Creators can update placeholders" ON public.placeholder_members
    FOR UPDATE USING (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Creators can delete placeholders" ON public.placeholder_members;
CREATE POLICY "Creators can delete placeholders" ON public.placeholder_members
    FOR DELETE USING (created_by = (select auth.uid()));

-- ============================================================================
-- 9. FIX RLS POLICIES - settlements table
-- ============================================================================

DROP POLICY IF EXISTS "Settlements are viewable by involved users" ON public.settlements;
CREATE POLICY "Settlements are viewable by involved users" ON public.settlements
    FOR SELECT USING (
        from_user = (select auth.uid()) 
        OR to_user = (select auth.uid())
        OR is_group_member(group_id, (select auth.uid()))
    );

DROP POLICY IF EXISTS "Group members can create settlements" ON public.settlements;
CREATE POLICY "Group members can create settlements" ON public.settlements
    FOR INSERT WITH CHECK (is_group_member(group_id, (select auth.uid())));

-- ============================================================================
-- 10. FIX RLS POLICIES - friendships table
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their friendships" ON public.friendships;
CREATE POLICY "Users can view their friendships" ON public.friendships
    FOR SELECT USING (
        user_id = (select auth.uid()) 
        OR friend_id = (select auth.uid())
    );

DROP POLICY IF EXISTS "Users can create friendship requests" ON public.friendships;
CREATE POLICY "Users can create friendship requests" ON public.friendships
    FOR INSERT WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their friendships" ON public.friendships;
CREATE POLICY "Users can update their friendships" ON public.friendships
    FOR UPDATE USING (
        user_id = (select auth.uid()) 
        OR friend_id = (select auth.uid())
    );

DROP POLICY IF EXISTS "Users can delete their friendships" ON public.friendships;
CREATE POLICY "Users can delete their friendships" ON public.friendships
    FOR DELETE USING (
        user_id = (select auth.uid()) 
        OR friend_id = (select auth.uid())
    );

-- ============================================================================
-- 11. FIX RLS POLICIES - notifications table
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications" ON public.notifications
    FOR DELETE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;
CREATE POLICY "Authenticated users can create notifications" ON public.notifications
    FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

-- ============================================================================
-- 12. FIX RLS POLICIES - group_invitations table
-- ============================================================================

DROP POLICY IF EXISTS "Users can view invitations they sent or received" ON public.group_invitations;
CREATE POLICY "Users can view invitations they sent or received" ON public.group_invitations
    FOR SELECT USING (
        (select auth.uid()) = invited_user_id 
        OR (select auth.uid()) = invited_by
    );

DROP POLICY IF EXISTS "Users can create invitations" ON public.group_invitations;
CREATE POLICY "Users can create invitations" ON public.group_invitations
    FOR INSERT WITH CHECK ((select auth.uid()) = invited_by);

DROP POLICY IF EXISTS "Invited users can update their invitations" ON public.group_invitations;
CREATE POLICY "Invited users can update their invitations" ON public.group_invitations
    FOR UPDATE USING ((select auth.uid()) = invited_user_id);

-- ============================================================================
-- 13. FIX RLS POLICIES - activities table
-- ============================================================================

DROP POLICY IF EXISTS "Activities are viewable by group members" ON public.activities;
CREATE POLICY "Activities are viewable by group members" ON public.activities
    FOR SELECT USING (is_group_member(group_id, (select auth.uid())));

DROP POLICY IF EXISTS "Group members can create activities" ON public.activities;
CREATE POLICY "Group members can create activities" ON public.activities
    FOR INSERT WITH CHECK (is_group_member(group_id, (select auth.uid())));

