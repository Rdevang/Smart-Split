# Database Schema

## Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────────┐       ┌─────────────┐
│   users     │       │  group_members  │       │   groups    │
├─────────────┤       ├─────────────────┤       ├─────────────┤
│ id (PK)     │◄──────│ user_id (FK)    │──────►│ id (PK)     │
│ email       │       │ group_id (FK)   │       │ name        │
│ full_name   │       │ role            │       │ description │
│ avatar_url  │       │ joined_at       │       │ image_url   │
│ created_at  │       └─────────────────┘       │ created_by  │
└─────────────┘                                 │ created_at  │
      │                                         └─────────────┘
      │                                               │
      │         ┌─────────────────┐                   │
      │         │    expenses     │                   │
      │         ├─────────────────┤                   │
      └────────►│ id (PK)         │◄──────────────────┘
                │ group_id (FK)   │
                │ paid_by (FK)    │
                │ amount          │
                │ description     │
                │ category        │
                │ split_type      │
                │ receipt_url     │
                │ date            │
                │ created_at      │
                └─────────────────┘
                        │
                        ▼
                ┌─────────────────┐
                │ expense_splits  │
                ├─────────────────┤
                │ id (PK)         │
                │ expense_id (FK) │
                │ user_id (FK)    │
                │ amount          │
                │ is_settled      │
                └─────────────────┘

┌─────────────────┐
│   settlements   │
├─────────────────┤
│ id (PK)         │
│ group_id (FK)   │
│ from_user (FK)  │
│ to_user (FK)    │
│ amount          │
│ settled_at      │
└─────────────────┘

┌─────────────────┐
│   friendships   │
├─────────────────┤
│ id (PK)         │
│ user_id (FK)    │
│ friend_id (FK)  │
│ status          │
│ created_at      │
└─────────────────┘
```

## SQL Schema (Supabase/PostgreSQL)

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Groups table
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Group members junction table
CREATE TABLE public.group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- Categories enum
CREATE TYPE expense_category AS ENUM (
  'food',
  'transport',
  'entertainment',
  'utilities',
  'rent',
  'shopping',
  'travel',
  'healthcare',
  'other'
);

-- Split type enum
CREATE TYPE split_type AS ENUM (
  'equal',
  'exact',
  'percentage'
);

-- Expenses table
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  paid_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  category expense_category DEFAULT 'other',
  split_type split_type DEFAULT 'equal',
  receipt_url TEXT,
  expense_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expense splits (who owes what)
CREATE TABLE public.expense_splits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_id UUID REFERENCES public.expenses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  is_settled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(expense_id, user_id)
);

-- Settlements table
CREATE TABLE public.settlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  from_user UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  to_user UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  note TEXT,
  settled_at TIMESTAMPTZ DEFAULT NOW()
);

-- Friendships table
CREATE TABLE public.friendships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id),
  CHECK (user_id != friend_id)
);

-- Activity log for feed
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_expenses_group_id ON public.expenses(group_id);
CREATE INDEX idx_expenses_paid_by ON public.expenses(paid_by);
CREATE INDEX idx_expense_splits_user_id ON public.expense_splits(user_id);
CREATE INDEX idx_group_members_user_id ON public.group_members(user_id);
CREATE INDEX idx_activities_group_id ON public.activities(group_id);
CREATE INDEX idx_activities_created_at ON public.activities(created_at DESC);
```

## Row Level Security (RLS) Policies

```sql
-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read all profiles, update only their own
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Groups: Only members can view/edit
CREATE POLICY "Groups are viewable by members" ON public.groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = groups.id
      AND group_members.user_id = auth.uid()
    )
  );

-- Add more policies as needed...
```

