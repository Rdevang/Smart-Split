# Database Schema

> Last Updated: 2024-12-10

## Overview

Smart Split uses Supabase (PostgreSQL) as its database. All tables have Row Level Security (RLS) enabled.

---

## Entity Relationship Diagram

```
┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐
│    profiles     │          │  group_members  │          │     groups      │
├─────────────────┤          ├─────────────────┤          ├─────────────────┤
│ id (PK, FK)     │◀────────▶│ user_id (FK)    │◀────────▶│ id (PK)         │
│ email           │          │ group_id (FK)   │          │ name            │
│ full_name       │          │ role            │          │ description     │
│ avatar_url      │          │ joined_at       │          │ created_by (FK) │
│ phone           │          └─────────────────┘          │ created_at      │
│ currency        │                   │                   └─────────────────┘
│ created_at      │                   │                           │
│ updated_at      │                   ▼                           │
└─────────────────┘          ┌─────────────────┐                  │
        │                    │    expenses     │◀─────────────────┘
        │                    ├─────────────────┤
        │                    │ id (PK)         │
        │                    │ group_id (FK)   │
        └───────────────────▶│ paid_by (FK)    │
                             │ amount          │
                             │ description     │
                             │ category        │
                             │ split_type      │
                             └─────────────────┘
                                     │
                                     ▼
                             ┌─────────────────┐
                             │ expense_splits  │
                             ├─────────────────┤
                             │ expense_id (FK) │
                             │ user_id (FK)    │
                             │ amount          │
                             │ is_settled      │
                             └─────────────────┘

┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐
│  settlements    │          │  friendships    │          │   activities    │
├─────────────────┤          ├─────────────────┤          ├─────────────────┤
│ group_id (FK)   │          │ user_id (FK)    │          │ group_id (FK)   │
│ from_user (FK)  │          │ friend_id (FK)  │          │ user_id (FK)    │
│ to_user (FK)    │          │ status          │          │ action          │
│ amount          │          │ created_at      │          │ entity_type     │
│ settled_at      │          └─────────────────┘          │ metadata (JSON) │
└─────────────────┘                                       └─────────────────┘
```

---

## Tables

### profiles

Extends Supabase `auth.users` with additional user data.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | - | Primary key, references auth.users |
| email | TEXT | NO | - | User's email address |
| full_name | TEXT | YES | NULL | Display name |
| avatar_url | TEXT | YES | NULL | Profile picture URL |
| phone | TEXT | YES | NULL | Phone number |
| currency | TEXT | YES | 'USD' | Preferred currency |
| created_at | TIMESTAMPTZ | YES | NOW() | Record creation time |
| updated_at | TIMESTAMPTZ | YES | NOW() | Last update time |

**Trigger**: `handle_new_user()` creates a profile when a user signs up.

---

### groups

Expense sharing groups.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| name | TEXT | NO | - | Group name |
| description | TEXT | YES | NULL | Group description |
| image_url | TEXT | YES | NULL | Group image |
| category | TEXT | YES | 'other' | Group category |
| simplify_debts | BOOLEAN | YES | TRUE | Auto-simplify balances |
| created_by | UUID | YES | NULL | Creator's user ID |
| created_at | TIMESTAMPTZ | YES | NOW() | Creation time |
| updated_at | TIMESTAMPTZ | YES | NOW() | Last update time |

---

### group_members

Junction table for group membership.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| group_id | UUID | NO | - | References groups.id |
| user_id | UUID | NO | - | References profiles.id |
| role | member_role | YES | 'member' | 'admin' or 'member' |
| joined_at | TIMESTAMPTZ | YES | NOW() | Join time |

**Unique Constraint**: (group_id, user_id)

---

### expenses

Individual expense records.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| group_id | UUID | NO | - | References groups.id |
| paid_by | UUID | NO | - | User who paid |
| amount | DECIMAL(12,2) | NO | - | Total amount (> 0) |
| description | TEXT | NO | - | Expense description |
| category | expense_category | YES | 'other' | Expense category |
| split_type | split_type | YES | 'equal' | How to split |
| receipt_url | TEXT | YES | NULL | Receipt image URL |
| notes | TEXT | YES | NULL | Additional notes |
| expense_date | DATE | YES | CURRENT_DATE | When expense occurred |
| created_at | TIMESTAMPTZ | YES | NOW() | Creation time |
| updated_at | TIMESTAMPTZ | YES | NOW() | Last update time |

---

### expense_splits

Who owes what for each expense.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| expense_id | UUID | NO | - | References expenses.id |
| user_id | UUID | NO | - | User who owes |
| amount | DECIMAL(12,2) | NO | - | Amount owed |
| percentage | DECIMAL(5,2) | YES | NULL | Percentage split |
| is_settled | BOOLEAN | YES | FALSE | Is debt paid? |
| settled_at | TIMESTAMPTZ | YES | NULL | When settled |
| created_at | TIMESTAMPTZ | YES | NOW() | Creation time |

**Unique Constraint**: (expense_id, user_id)

---

### settlements

Payment records between users.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| group_id | UUID | YES | NULL | References groups.id |
| from_user | UUID | NO | - | User who paid |
| to_user | UUID | NO | - | User who received |
| amount | DECIMAL(12,2) | NO | - | Amount (> 0) |
| note | TEXT | YES | NULL | Payment note |
| settled_at | TIMESTAMPTZ | YES | NOW() | Settlement time |
| created_at | TIMESTAMPTZ | YES | NOW() | Creation time |

**Check Constraint**: from_user != to_user

---

### friendships

Friend connections between users.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| user_id | UUID | NO | - | Requester |
| friend_id | UUID | NO | - | Recipient |
| status | friendship_status | YES | 'pending' | Status |
| created_at | TIMESTAMPTZ | YES | NOW() | Request time |
| updated_at | TIMESTAMPTZ | YES | NOW() | Last update |

**Unique Constraint**: (user_id, friend_id)
**Check Constraint**: user_id != friend_id

---

### activities

Activity feed log.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| group_id | UUID | YES | NULL | Related group |
| user_id | UUID | YES | NULL | Acting user |
| action | TEXT | NO | - | Action type |
| entity_type | TEXT | NO | - | Entity type |
| entity_id | UUID | YES | NULL | Entity ID |
| metadata | JSONB | YES | '{}' | Additional data |
| created_at | TIMESTAMPTZ | YES | NOW() | Activity time |

---

## Custom Types

### expense_category
```sql
CREATE TYPE expense_category AS ENUM (
  'food', 'transport', 'entertainment', 'utilities',
  'rent', 'shopping', 'travel', 'healthcare', 'groceries', 'other'
);
```

### split_type
```sql
CREATE TYPE split_type AS ENUM ('equal', 'exact', 'percentage');
```

### member_role
```sql
CREATE TYPE member_role AS ENUM ('admin', 'member');
```

### friendship_status
```sql
CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'blocked');
```

---

## Functions

### get_group_balances(group_uuid UUID)

Calculates who owes whom in a group.

**Returns**: TABLE (user_id UUID, user_name TEXT, balance DECIMAL)

**Logic**:
- Positive balance = user is owed money
- Negative balance = user owes money

### handle_new_user()

Trigger function that creates a profile when a user signs up.

**Triggered by**: INSERT on auth.users

### update_updated_at_column()

Updates the `updated_at` column to NOW().

**Triggered by**: UPDATE on profiles, groups, expenses, friendships

---

## Indexes

```sql
-- Expenses
CREATE INDEX idx_expenses_group_id ON expenses(group_id);
CREATE INDEX idx_expenses_paid_by ON expenses(paid_by);
CREATE INDEX idx_expenses_date ON expenses(expense_date DESC);
CREATE INDEX idx_expenses_created_at ON expenses(created_at DESC);

-- Expense Splits
CREATE INDEX idx_expense_splits_expense_id ON expense_splits(expense_id);
CREATE INDEX idx_expense_splits_user_id ON expense_splits(user_id);
CREATE INDEX idx_expense_splits_unsettled ON expense_splits(user_id) WHERE is_settled = FALSE;

-- Group Members
CREATE INDEX idx_group_members_user_id ON group_members(user_id);
CREATE INDEX idx_group_members_group_id ON group_members(group_id);

-- Settlements
CREATE INDEX idx_settlements_from_user ON settlements(from_user);
CREATE INDEX idx_settlements_to_user ON settlements(to_user);
CREATE INDEX idx_settlements_group_id ON settlements(group_id);

-- Friendships
CREATE INDEX idx_friendships_user_id ON friendships(user_id);
CREATE INDEX idx_friendships_friend_id ON friendships(friend_id);

-- Activities
CREATE INDEX idx_activities_group_id ON activities(group_id);
CREATE INDEX idx_activities_user_id ON activities(user_id);
CREATE INDEX idx_activities_created_at ON activities(created_at DESC);
```

---

## Row Level Security Policies

All tables have RLS enabled. Key policies:

| Table | Policy | Access |
|-------|--------|--------|
| profiles | View all, update own | Authenticated |
| groups | View if member | Members only |
| group_members | View if in group | Members only |
| expenses | View if in group | Members only |
| expense_splits | View if in group | Members only |
| settlements | View if involved | Participants only |
| friendships | View own | Own friendships |
| activities | View if in group | Members only |

---

## Migrations

Migrations are stored in `supabase/migrations/`:

| File | Description |
|------|-------------|
| `20251210145314_init_schema.sql` | Initial schema with all tables |
| `20251210152120_add_storage_bucket.sql` | Avatars storage bucket |

### Running Migrations

```bash
# Push migrations to Supabase
export SUPABASE_ACCESS_TOKEN=your_token
npx supabase link --project-ref cizakzarkdgieclbwljy
npx supabase db push

# Generate TypeScript types
npx supabase gen types typescript --project-id cizakzarkdgieclbwljy > src/types/database.ts
```

