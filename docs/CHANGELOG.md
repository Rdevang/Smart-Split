# Changelog

All notable changes to Smart Split will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] - 2024-12-10

### Added

#### Authentication
- Email/password authentication with Supabase Auth
- Google OAuth integration (requires Google Cloud Console setup)
- GitHub OAuth integration (requires GitHub Developer settings)
- Auth callback route (`/auth/callback`) for OAuth flows
- Error handling for expired OTP and access denied errors
- Login page with social login buttons
- Registration page with password validation
- Protected route middleware

#### Database
- Complete database schema with 8 tables:
  - `profiles` - User profiles extending auth.users
  - `groups` - Expense sharing groups
  - `group_members` - Group membership junction table
  - `expenses` - Individual expense records
  - `expense_splits` - Who owes what per expense
  - `settlements` - Payment/settlement records
  - `friendships` - Friend connections
  - `activities` - Activity feed log
- Custom PostgreSQL types: `expense_category`, `split_type`, `member_role`, `friendship_status`
- Row Level Security (RLS) policies for all tables
- Database functions: `get_group_balances()`, `handle_new_user()`, `update_updated_at_column()`
- Automatic profile creation trigger on user signup

#### Dashboard
- Navbar component with navigation and profile dropdown
- Mobile-responsive hamburger menu
- Dashboard overview page with stats cards
- Groups page (placeholder)
- Expenses page (placeholder)
- Activity page (placeholder)
- Settings page with navigation cards

#### Profile System
- Profile settings page
- Avatar upload to Supabase Storage (2MB limit)
- Avatar delete functionality
- Profile service (`src/services/profile.ts`)
- Form validation with Zod
- Currency preference (8 currencies supported)

#### Storage
- `avatars` storage bucket with RLS policies
- File type validation (JPEG, PNG, GIF, WebP)
- Size validation (max 2MB)

#### UI Components
- Button component with 6 variants and 4 sizes
- Input component with label, error, and helper text
- Card component family (Card, CardHeader, CardTitle, etc.)
- Navbar with profile dropdown

#### Testing
- Jest configuration with Next.js integration
- React Testing Library setup
- 66 tests across 5 test suites
- Tests for Button, Input, Card, utils, and profile service

#### Developer Experience
- Self-evolving `.cursorrules` file
- Documentation structure in `/docs`
- ESLint + Prettier configuration
- TypeScript strict mode

### Technical Details

- Next.js 16.0.8 with App Router
- React 19.2.1
- Supabase SSR with @supabase/ssr
- Tailwind CSS 4 with custom theme
- Class Variance Authority (CVA) for component variants
- `cn()` utility with clsx + tailwind-merge

---

## [1.0.0] - 2024-12-10

### Added

#### Project Bootstrap
- Next.js 16 project initialization
- TypeScript configuration (strict mode)
- Tailwind CSS 4 setup
- ESLint + Prettier configuration
- Folder structure established

#### Supabase Integration
- Supabase client setup (browser + server)
- Middleware for session management
- Route protection pattern

#### Landing Page
- Hero section with CTA
- Features section (4 feature cards)
- How It Works section (3 steps)
- CTA section
- Footer

#### Auth Pages
- Split-screen auth layout (branding + form)
- Login page structure
- Register page structure

#### Base Components
- Button with variants (CVA)
- Input with validation support
- Card component family

---

## [Unreleased]

### Planned
- Groups CRUD functionality
- Expense creation and splitting
- Real-time activity feed
- Toast notifications
- Email notifications
- Settlement tracking

---

## Version History Summary

| Version | Date | Highlights |
|---------|------|------------|
| 2.0.0 | 2024-12-10 | Full auth, database schema, profile system, testing |
| 1.0.0 | 2024-12-10 | Project bootstrap, landing page, auth UI |

