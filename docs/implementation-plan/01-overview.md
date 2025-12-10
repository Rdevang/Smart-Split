# Smart Split - Implementation Plan

## Overview
Smart Split is an expense-sharing application similar to Splitwise, built with Next.js 16, Supabase, and Tailwind CSS.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| Backend/Auth | Supabase (PostgreSQL + Auth + Realtime) |
| State Management | React Context + Server Components |
| Forms | React Hook Form + Zod |
| Deployment | Vercel |

## Core Features (MVP)

### Phase 1: Authentication & User Management
- [x] Project setup
- [ ] Supabase integration
- [ ] User registration (email/password)
- [ ] User login
- [ ] Password reset
- [ ] User profile management

### Phase 2: Groups & Contacts
- [ ] Create/edit/delete groups
- [ ] Add/remove members to groups
- [ ] Friend system (add contacts)
- [ ] Group settings

### Phase 3: Expenses
- [ ] Add expense (amount, description, date, category)
- [ ] Split types: Equal, Exact amounts, Percentages
- [ ] Attach receipts (image upload)
- [ ] Recurring expenses
- [ ] Categories with icons

### Phase 4: Balances & Settlements
- [ ] Calculate who owes whom
- [ ] Simplify debts (minimize transactions)
- [ ] Record settlements/payments
- [ ] Settlement reminders

### Phase 5: Activity & Notifications
- [ ] Activity feed (group & personal)
- [ ] Push notifications
- [ ] Email notifications
- [ ] Expense reminders

## Architecture Principles

1. **SOLID Principles**
   - Single Responsibility: Each component/service does one thing
   - Open/Closed: Extensible without modification
   - Dependency Inversion: Depend on abstractions (interfaces)

2. **Separation of Concerns**
   - `/app` - Routes and page components only
   - `/components` - Reusable UI components
   - `/services` - Business logic and API calls
   - `/hooks` - Custom React hooks
   - `/lib` - Utilities and configurations
   - `/types` - TypeScript interfaces

3. **DRY (Don't Repeat Yourself)**
   - Shared components for forms, buttons, inputs
   - Centralized API service layer
   - Reusable hooks for common patterns

## File Structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── register/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── groups/
│   │   ├── expenses/
│   │   ├── activity/
│   │   ├── settings/
│   │   └── layout.tsx
│   ├── layout.tsx
│   ├── page.tsx (landing)
│   └── globals.css
├── components/
│   ├── ui/           # Base UI components (Button, Input, Card, etc.)
│   ├── forms/        # Form components
│   ├── layout/       # Layout components (Header, Footer, Sidebar)
│   └── features/     # Feature-specific components
├── services/
│   ├── auth.ts       # Authentication service
│   ├── groups.ts     # Groups CRUD
│   ├── expenses.ts   # Expenses CRUD
│   └── settlements.ts
├── hooks/
│   ├── useAuth.ts
│   ├── useGroups.ts
│   └── useExpenses.ts
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   └── utils.ts
└── types/
    ├── database.ts   # Supabase generated types
    ├── auth.ts
    ├── group.ts
    └── expense.ts
```

## Security Considerations

1. Row Level Security (RLS) in Supabase for all tables
2. Server-side authentication checks
3. Input validation with Zod
4. CSRF protection (built into Next.js)
5. Rate limiting on auth endpoints

