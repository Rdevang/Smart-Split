# Smart Split - Developer Documentation

> **Version**: 2.7.0 | **Last Updated**: 2024-12-18

Smart Split is a full-featured expense-sharing application built with Next.js 16, Supabase, and Tailwind CSS. This documentation covers everything you need to develop, test, and deploy the application.

---

## 📚 Table of Contents

- [Quick Start](#-quick-start)
- [Project Structure](#-project-structure)
- [Architecture](#-architecture)
- [Development Guidelines](#-development-guidelines)
- [Testing](#-testing)
- [Security](#-security)
- [Deployment](#-deployment)
- [Documentation Map](#-documentation-map)

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- Supabase account
- (Optional) Upstash Redis account for caching

### Installation

```bash
# Clone the repository
git clone https://github.com/Rdevang/Smart-Split.git
cd Smart-Split

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run database migrations (if setting up fresh)
npx supabase db push

# Generate TypeScript types from database
npm run db:types

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### Environment Variables

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Optional (for caching/rate limiting)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# Optional (for cron jobs)
CRON_SECRET=your-secret
```

---

## 📁 Project Structure

```
smart-split/
├── docs/                        # Documentation
│   ├── security/                # Security audit & procedures
│   │   ├── SECURITY_AUDIT.md    # Full security audit
│   │   ├── STORED_PROCEDURES_REVIEW.md
│   │   └── INFRASTRUCTURE_SECURITY.md
│   ├── development/             # Development guides
│   │   ├── architecture.md      # System architecture
│   │   ├── database.md          # Database schema
│   │   ├── components.md        # Component library
│   │   └── system-design.md     # Performance & caching
│   └── api/                     # API documentation
│       └── services.md          # Service layer docs
├── public/                      # Static assets
├── src/
│   ├── app/                     # Next.js App Router pages
│   │   ├── (auth)/              # Authentication (login, register)
│   │   ├── (dashboard)/         # Protected pages
│   │   │   ├── groups/          # Group management
│   │   │   ├── expenses/        # Expense tracking
│   │   │   ├── settings/        # User settings
│   │   │   └── activity/        # Activity feed
│   │   ├── api/                 # API routes
│   │   │   ├── v1/              # Versioned API
│   │   │   ├── cache/           # Cache health/stats
│   │   │   └── cron/            # Scheduled jobs
│   │   └── feedback/            # Public feedback page
│   ├── components/
│   │   ├── ui/                  # Reusable UI components
│   │   │   ├── button.tsx       # Button with variants
│   │   │   ├── input.tsx        # Form input
│   │   │   ├── card.tsx         # Card container
│   │   │   ├── badge.tsx        # Status badges
│   │   │   ├── select.tsx       # Dropdown select
│   │   │   ├── spinner.tsx      # Loading spinner
│   │   │   └── qr-scanner.tsx   # QR code scanner
│   │   ├── layout/              # Layout components
│   │   │   ├── navbar.tsx       # Navigation bar
│   │   │   └── navigation-progress.tsx
│   │   ├── forms/               # Form components
│   │   │   └── csrf-input.tsx   # CSRF token input
│   │   └── features/            # Feature-specific components
│   │       ├── groups/          # Group components
│   │       ├── expenses/        # Expense components
│   │       ├── friends/         # Friends components
│   │       └── feedback/        # Feedback components
│   ├── hooks/                   # Custom React hooks
│   │   └── use-optimistic-action.ts
│   ├── lib/                     # Utilities and configurations
│   │   ├── supabase/            # Supabase client setup
│   │   ├── utils.ts             # General utilities (cn)
│   │   ├── currency.ts          # Currency formatting
│   │   ├── validation.ts        # Input validation & sanitization
│   │   ├── cache.ts             # Redis caching
│   │   ├── rate-limit.ts        # Rate limiting
│   │   ├── logger.ts            # Structured logging
│   │   ├── csrf.ts              # CSRF protection
│   │   └── api-errors.ts        # API error handling
│   ├── services/                # Business logic layer
│   │   ├── profile.ts           # Profile CRUD
│   │   ├── groups.ts            # Groups (client)
│   │   ├── groups.server.ts     # Groups (server)
│   │   ├── expenses.ts          # Expenses (client)
│   │   ├── expenses.server.ts   # Expenses (server)
│   │   └── audit.ts             # Audit logging
│   ├── types/                   # TypeScript definitions
│   │   └── database.ts          # Generated Supabase types
│   └── __tests__/               # Jest test files
├── supabase/
│   └── migrations/              # Database migrations
├── .cursorrules                 # AI assistant rules
├── .env.example                 # Environment template
├── jest.config.ts               # Jest configuration
├── next.config.ts               # Next.js configuration
└── vercel.json                  # Vercel configuration
```

---

## 🏗️ Architecture

### Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 16 (App Router) | React Server Components, routing |
| UI | Tailwind CSS 4 | Utility-first styling |
| Database | Supabase (PostgreSQL) | Data persistence, RLS |
| Auth | Supabase Auth | Email, Google, GitHub OAuth |
| Caching | Upstash Redis | Distributed caching |
| Forms | React Hook Form + Zod | Validation |
| Charts | Recharts | Data visualization |
| Testing | Jest + RTL | Unit & integration tests |

### Design Principles

1. **Server Components First** - Use RSC for data fetching, "use client" only when needed
2. **Service Layer Pattern** - Business logic in `/services`, not components
3. **Type Safety** - Full TypeScript with generated Supabase types
4. **Mobile-First** - Responsive design with Tailwind breakpoints
5. **Security by Default** - RLS, CSRF, rate limiting, input validation

### Data Flow

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Page/Layout    │────▶│     Service      │────▶│    Supabase      │
│  (Server Comp)   │     │   (Business)     │     │   (Database)     │
└──────────────────┘     └──────────────────┘     └──────────────────┘
         │                        │
         ▼                        ▼
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Client Comp     │     │  Server Action   │────▶│   Redis Cache    │
│  (Interactive)   │────▶│   (Mutations)    │     │   (Optional)     │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

### Caching Strategy

- **Redis (Upstash)** - Distributed cache with circuit breaker
- **SWR Pattern** - Return stale data, refresh in background
- **Tag-Based Invalidation** - Semantic cache groups
- **Graceful Degradation** - App works if Redis is down

---

## 👨‍💻 Development Guidelines

### Component Creation

1. Create in appropriate folder (`/ui`, `/layout`, `/features`)
2. Use CVA (class-variance-authority) for variants
3. Accept `className` prop for customization
4. Use `forwardRef` for DOM element access
5. Create test file in `__tests__/`

Example:

```tsx
import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva("base-classes", {
  variants: { variant: { default: "...", outline: "..." } },
  defaultVariants: { variant: "default" },
});

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, className }))}
      {...props}
    />
  )
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

### Adding a New Feature

1. Plan database schema changes (if needed)
2. Create Supabase migration in `supabase/migrations/`
3. Generate types: `npm run db:types`
4. Create service layer in `/services`
5. Create UI components
6. Add tests
7. Update documentation

### Server vs Client Services

- **Server Components** → Use `*.server.ts` services
- **Client Components** → Use regular `*.ts` services

```tsx
// ❌ Wrong - browser client in Server Component
import { groupsService } from "@/services/groups";

// ✅ Correct - server client in Server Component
import { groupsServerService } from "@/services/groups.server";
```

### Git Workflow

```bash
# Feature branch
git checkout -b feature/new-feature

# Conventional commits
git commit -m "feat: add expense editing"
git commit -m "fix: resolve balance calculation"
git commit -m "docs: update API documentation"

# Push and create PR
git push origin feature/new-feature
```

---

## 🧪 Testing

### Running Tests

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

### Test Structure

```
src/__tests__/
├── components/
│   ├── ui/
│   │   ├── button.test.tsx
│   │   └── input.test.tsx
│   └── features/
│       └── groups/
├── services/
│   └── profile.test.ts
└── lib/
    └── utils.test.ts
```

### Writing Tests

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders correctly", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button")).toHaveTextContent("Click me");
  });

  it("handles click", async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    
    render(<Button onClick={onClick}>Click</Button>);
    await user.click(screen.getByRole("button"));
    
    expect(onClick).toHaveBeenCalled();
  });
});
```

### Testing Components with Providers

```tsx
import { ToastProvider } from "@/components/ui/toast";

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
);

render(<MyComponent />, { wrapper: TestWrapper });
```

---

## 🔒 Security

### Implemented Security Measures

| Category | Implementation |
|----------|----------------|
| **Auth** | CSRF tokens, rate limiting, account lockout |
| **Input** | Zod validation, XSS sanitization, length limits |
| **Database** | RLS policies, parameterized queries |
| **API** | Rate limiting, versioning, generic errors |
| **Monitoring** | Structured logging, PII redaction |

### Security Documentation

- [SECURITY_AUDIT.md](./security/SECURITY_AUDIT.md) - Full security audit
- [STORED_PROCEDURES_REVIEW.md](./security/STORED_PROCEDURES_REVIEW.md) - SQL review checklist
- [INFRASTRUCTURE_SECURITY.md](./security/INFRASTRUCTURE_SECURITY.md) - Infrastructure setup

---

## 🚀 Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import repository in [Vercel Dashboard](https://vercel.com/new)
3. Set environment variables
4. Deploy

### Environment Variables on Vercel

Set these in Vercel Dashboard → Project → Settings → Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SITE_URL (set to production URL)
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
CRON_SECRET
```

### Production Checklist

- [ ] All environment variables set
- [ ] OAuth redirect URLs configured for production domain
- [ ] Supabase Site URL updated
- [ ] Rate limits appropriate for traffic
- [ ] Error monitoring configured

---

## 📜 NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run Jest tests |
| `npm run test:watch` | Jest in watch mode |
| `npm run test:coverage` | Generate coverage report |
| `npm run analyze` | Analyze bundle size |
| `npm run db:types` | Generate Supabase types |

---

## 📖 Documentation Map

| Document | Description |
|----------|-------------|
| [CHANGELOG.md](./CHANGELOG.md) | Version history |
| [architecture.md](./development/architecture.md) | System architecture |
| [database.md](./development/database.md) | Database schema |
| [components.md](./development/components.md) | Component library |
| [system-design.md](./development/system-design.md) | Performance & caching |
| [services.md](./api/services.md) | Service layer API |
| [SECURITY_AUDIT.md](./security/SECURITY_AUDIT.md) | Security audit |

---

## 🆘 Support

1. Check existing documentation
2. Review `.cursorrules` for project conventions
3. Create a GitHub issue
4. Use the in-app feedback feature

---

<p align="center">
<strong>Smart Split</strong> — Expense sharing made simple
</p>
