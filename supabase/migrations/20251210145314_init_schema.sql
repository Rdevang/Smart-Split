-- Smart Split Database Schema
-- Version: 1.0.0
-- Description: Initial schema for expense sharing application

-- ============================================================================
-- CUSTOM TYPES
-- ============================================================================

-- Expense categories
CREATE TYPE expense_category AS ENUM (
  'food',
  'transport',
  'entertainment',
  'utilities',
  'rent',
  'shopping',
  'travel',
  'healthcare',
  'groceries',
  'other'
);

-- Split types for expenses
CREATE TYPE split_type AS ENUM (
  'equal',
  'exact',
  'percentage'
);

-- Group member roles
CREATE TYPE member_role AS ENUM (
  'admin',
  'member'
);

-- Friendship status
CREATE TYPE friendship_status AS ENUM (
  'pending',
  'accepted',
  'blocked'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- Profiles table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Groups table
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  category TEXT DEFAULT 'other',
  simplify_debts BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Group members junction table
CREATE TABLE public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role member_role DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- Expenses table
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  paid_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  category expense_category DEFAULT 'other',
  split_type split_type DEFAULT 'equal',
  receipt_url TEXT,
  notes TEXT,
  expense_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expense splits (who owes what for each expense)
CREATE TABLE public.expense_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  percentage DECIMAL(5, 2),
  is_settled BOOLEAN DEFAULT FALSE,
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(expense_id, user_id)
);

-- Settlements table (record payments between users)
CREATE TABLE public.settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  from_user UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  note TEXT,
  settled_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (from_user != to_user)
);

-- Friendships table
CREATE TABLE public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status friendship_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id),
  CHECK (user_id != friend_id)
);

-- Activity log for feed
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Expenses indexes
CREATE INDEX idx_expenses_group_id ON public.expenses(group_id);
CREATE INDEX idx_expenses_paid_by ON public.expenses(paid_by);
CREATE INDEX idx_expenses_date ON public.expenses(expense_date DESC);
CREATE INDEX idx_expenses_created_at ON public.expenses(created_at DESC);

-- Expense splits indexes
CREATE INDEX idx_expense_splits_expense_id ON public.expense_splits(expense_id);
CREATE INDEX idx_expense_splits_user_id ON public.expense_splits(user_id);
CREATE INDEX idx_expense_splits_unsettled ON public.expense_splits(user_id) WHERE is_settled = FALSE;

-- Group members indexes
CREATE INDEX idx_group_members_user_id ON public.group_members(user_id);
CREATE INDEX idx_group_members_group_id ON public.group_members(group_id);

-- Settlements indexes
CREATE INDEX idx_settlements_from_user ON public.settlements(from_user);
CREATE INDEX idx_settlements_to_user ON public.settlements(to_user);
CREATE INDEX idx_settlements_group_id ON public.settlements(group_id);

-- Friendships indexes
CREATE INDEX idx_friendships_user_id ON public.friendships(user_id);
CREATE INDEX idx_friendships_friend_id ON public.friendships(friend_id);

-- Activities indexes
CREATE INDEX idx_activities_group_id ON public.activities(group_id);
CREATE INDEX idx_activities_user_id ON public.activities(user_id);
CREATE INDEX idx_activities_created_at ON public.activities(created_at DESC);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate user balance in a group
CREATE OR REPLACE FUNCTION public.get_group_balances(group_uuid UUID)
RETURNS TABLE (
  user_id UUID,
  user_name TEXT,
  balance DECIMAL(12, 2)
) AS $$
BEGIN
  RETURN QUERY
  WITH paid AS (
    SELECT 
      e.paid_by as uid,
      COALESCE(SUM(e.amount), 0) as total_paid
    FROM public.expenses e
    WHERE e.group_id = group_uuid
    GROUP BY e.paid_by
  ),
  owed AS (
    SELECT 
      es.user_id as uid,
      COALESCE(SUM(es.amount), 0) as total_owed
    FROM public.expense_splits es
    JOIN public.expenses e ON e.id = es.expense_id
    WHERE e.group_id = group_uuid AND es.is_settled = FALSE
    GROUP BY es.user_id
  ),
  settled_out AS (
    SELECT 
      s.from_user as uid,
      COALESCE(SUM(s.amount), 0) as total_out
    FROM public.settlements s
    WHERE s.group_id = group_uuid
    GROUP BY s.from_user
  ),
  settled_in AS (
    SELECT 
      s.to_user as uid,
      COALESCE(SUM(s.amount), 0) as total_in
    FROM public.settlements s
    WHERE s.group_id = group_uuid
    GROUP BY s.to_user
  )
  SELECT 
    gm.user_id,
    p.full_name,
    (COALESCE(paid.total_paid, 0) - COALESCE(owed.total_owed, 0) + COALESCE(settled_out.total_out, 0) - COALESCE(settled_in.total_in, 0))::DECIMAL(12, 2) as balance
  FROM public.group_members gm
  JOIN public.profiles p ON p.id = gm.user_id
  LEFT JOIN paid ON paid.uid = gm.user_id
  LEFT JOIN owed ON owed.uid = gm.user_id
  LEFT JOIN settled_out ON settled_out.uid = gm.user_id
  LEFT JOIN settled_in ON settled_in.uid = gm.user_id
  WHERE gm.group_id = group_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at for profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at for groups
CREATE TRIGGER update_groups_updated_at
  BEFORE UPDATE ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at for expenses
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at for friendships
CREATE TRIGGER update_friendships_updated_at
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create profile on new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Groups policies
CREATE POLICY "Groups are viewable by members"
  ON public.groups FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = groups.id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can create groups"
  ON public.groups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Group admins can update groups"
  ON public.groups FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = groups.id
      AND group_members.user_id = auth.uid()
      AND group_members.role = 'admin'
    )
  );

CREATE POLICY "Group admins can delete groups"
  ON public.groups FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = groups.id
      AND group_members.user_id = auth.uid()
      AND group_members.role = 'admin'
    )
  );

-- Group members policies
CREATE POLICY "Group members are viewable by group members"
  ON public.group_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Group admins can add members"
  ON public.group_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
      AND gm.role = 'admin'
    )
    OR 
    -- Allow first member (creator) to be added
    NOT EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_members.group_id
    )
  );

CREATE POLICY "Group admins can remove members"
  ON public.group_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
      AND gm.role = 'admin'
    )
    OR user_id = auth.uid() -- Users can leave groups
  );

-- Expenses policies
CREATE POLICY "Expenses are viewable by group members"
  ON public.expenses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = expenses.group_id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can create expenses"
  ON public.expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = expenses.group_id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Expense creator can update"
  ON public.expenses FOR UPDATE
  TO authenticated
  USING (paid_by = auth.uid());

CREATE POLICY "Expense creator can delete"
  ON public.expenses FOR DELETE
  TO authenticated
  USING (paid_by = auth.uid());

-- Expense splits policies
CREATE POLICY "Expense splits are viewable by group members"
  ON public.expense_splits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expenses e
      JOIN public.group_members gm ON gm.group_id = e.group_id
      WHERE e.id = expense_splits.expense_id
      AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can create expense splits"
  ON public.expense_splits FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expenses e
      JOIN public.group_members gm ON gm.group_id = e.group_id
      WHERE e.id = expense_splits.expense_id
      AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Expense creator can update splits"
  ON public.expense_splits FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_splits.expense_id
      AND e.paid_by = auth.uid()
    )
  );

CREATE POLICY "Expense creator can delete splits"
  ON public.expense_splits FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_splits.expense_id
      AND e.paid_by = auth.uid()
    )
  );

-- Settlements policies
CREATE POLICY "Settlements are viewable by involved users"
  ON public.settlements FOR SELECT
  TO authenticated
  USING (
    from_user = auth.uid() OR to_user = auth.uid()
    OR (
      group_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_members.group_id = settlements.group_id
        AND group_members.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create settlements they're involved in"
  ON public.settlements FOR INSERT
  TO authenticated
  WITH CHECK (from_user = auth.uid());

-- Friendships policies
CREATE POLICY "Users can view their friendships"
  ON public.friendships FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR friend_id = auth.uid());

CREATE POLICY "Users can create friendship requests"
  ON public.friendships FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their friendships"
  ON public.friendships FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR friend_id = auth.uid());

CREATE POLICY "Users can delete their friendships"
  ON public.friendships FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR friend_id = auth.uid());

-- Activities policies
CREATE POLICY "Activities are viewable by group members"
  ON public.activities FOR SELECT
  TO authenticated
  USING (
    group_id IS NULL AND user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = activities.group_id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can create activities"
  ON public.activities FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      group_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_members.group_id = activities.group_id
        AND group_members.user_id = auth.uid()
      )
    )
  );

