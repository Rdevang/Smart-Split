# Architecture Overview

> Last Updated: 2024-12-10

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT BROWSER                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Landing   │  │    Auth     │  │       Dashboard         │  │
│  │    Page     │  │   Pages     │  │   (Protected Routes)    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│         │                │                      │               │
│         └────────────────┼──────────────────────┘               │
│                          ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    COMPONENT LAYER                          ││
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    ││
│  │  │    UI    │  │  Layout  │  │  Forms   │  │ Features │    ││
│  │  │Components│  │Components│  │Components│  │Components│    ││
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘    ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                         NEXT.JS SERVER                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                     MIDDLEWARE LAYER                        ││
│  │           Session Refresh • Route Protection                ││
│  └─────────────────────────────────────────────────────────────┘│
│                               │                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    SERVER COMPONENTS                        ││
│  │         Data Fetching • Layout Rendering • SSR              ││
│  └─────────────────────────────────────────────────────────────┘│
│                               │                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                     SERVER ACTIONS                          ││
│  │       Form Handling • Mutations • Revalidation              ││
│  └─────────────────────────────────────────────────────────────┘│
│                               │                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                     SERVICE LAYER                           ││
│  │           Business Logic • Data Transformation              ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                          SUPABASE                               │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │     Auth     │  │   Database   │  │       Storage        │  │
│  │   (GoTrue)   │  │ (PostgreSQL) │  │   (Object Storage)   │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                               │                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                  ROW LEVEL SECURITY (RLS)                   ││
│  │              Policy-based Access Control                    ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Route Structure

### Public Routes
| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/login` | Login page |
| `/register` | Registration page |
| `/auth/callback` | OAuth callback handler |

### Protected Routes (require authentication)
| Route | Description |
|-------|-------------|
| `/dashboard` | Main dashboard |
| `/groups` | Groups list |
| `/expenses` | Expenses list |
| `/activity` | Activity feed |
| `/settings` | Settings overview |
| `/settings/profile` | Profile settings |

---

## Component Architecture

### Layer Hierarchy

```
┌─────────────────────────────────────────────────┐
│                  PAGE COMPONENTS                │
│     Server Components • Data Fetching          │
└─────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│               LAYOUT COMPONENTS                 │
│         Navbar • Sidebar • Footer              │
└─────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│              FEATURE COMPONENTS                 │
│    GroupCard • ExpenseList • ActivityFeed      │
└─────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│                 UI COMPONENTS                   │
│       Button • Input • Card • Dialog           │
└─────────────────────────────────────────────────┘
```

### Component Types

| Type | Location | Rendering | Example |
|------|----------|-----------|---------|
| Page | `app/` | Server | `page.tsx` |
| Layout | `components/layout/` | Server/Client | `Navbar` |
| Feature | `components/features/` | Client | `ExpenseCard` |
| UI | `components/ui/` | Client | `Button` |
| Form | `components/forms/` | Client | `LoginForm` |

---

## Data Flow Patterns

### Read Pattern (Server Components)

```tsx
// Page fetches data
export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("expenses").select("*");
  
  return <ExpenseList expenses={data} />;
}
```

### Write Pattern (Server Actions)

```tsx
// Server Action handles mutation
"use server";
export async function createExpense(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").insert({...});
  
  if (error) return { error: error.message };
  revalidatePath("/expenses");
}

// Client component calls action
"use client";
export function ExpenseForm() {
  return <form action={createExpense}>...</form>;
}
```

### Service Pattern (Business Logic)

```tsx
// Service encapsulates business logic
export const expenseService = {
  async splitEqually(amount: number, members: string[]) {
    const perPerson = amount / members.length;
    return members.map(id => ({ user_id: id, amount: perPerson }));
  },
};
```

---

## Authentication Flow

```
┌──────────┐     ┌────────────┐     ┌──────────────┐     ┌──────────┐
│  Client  │────▶│ Login Page │────▶│ Server Action│────▶│ Supabase │
└──────────┘     └────────────┘     └──────────────┘     └──────────┘
                                           │                    │
                                           │                    ▼
                                           │              ┌──────────┐
                                           │              │   Auth   │
                                           │              │  (JWT)   │
                                           │              └──────────┘
                                           │                    │
                                           ▼                    ▼
                                    ┌────────────┐     ┌──────────────┐
                                    │  Redirect  │◀────│ Set Cookies  │
                                    │ /dashboard │     │  (Session)   │
                                    └────────────┘     └──────────────┘
```

### OAuth Flow

1. User clicks "Sign in with Google"
2. Server Action calls `supabase.auth.signInWithOAuth()`
3. User redirected to Google
4. Google redirects to `/auth/callback`
5. Callback exchanges code for session
6. User redirected to `/dashboard`

---

## Security Model

### Row Level Security (RLS)

All tables have RLS enabled with policies:

```sql
-- Users can only see their own data
CREATE POLICY "Users can view own expenses"
ON expenses FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM group_members
    WHERE group_members.group_id = expenses.group_id
    AND group_members.user_id = auth.uid()
  )
);
```

### Security Layers

1. **Middleware**: Session validation, route protection
2. **Server Actions**: Input validation with Zod
3. **Supabase RLS**: Database-level access control
4. **Storage Policies**: File access control

---

## File Upload Architecture

```
┌──────────┐     ┌────────────┐     ┌──────────────┐     ┌──────────┐
│  Client  │────▶│  Service   │────▶│   Storage    │────▶│  Bucket  │
│  (File)  │     │ (Validate) │     │   (Upload)   │     │ (avatars)│
└──────────┘     └────────────┘     └──────────────┘     └──────────┘
                       │                                       │
                       ▼                                       ▼
                ┌────────────┐                          ┌──────────┐
                │  Profiles  │◀─────────────────────────│Public URL│
                │   Table    │                          └──────────┘
                └────────────┘
```

### Upload Flow
1. Client selects file
2. Service validates (size: 2MB, type: image/*)
3. Old avatar deleted from storage
4. New file uploaded to `avatars/{userId}/`
5. Public URL saved to `profiles.avatar_url`

