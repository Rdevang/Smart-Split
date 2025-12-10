# Smart Split - Developer Documentation

> **Version**: 2.0.0 | **Last Updated**: 2024-12-10

Smart Split is an expense-sharing application built with Next.js 16, Supabase, and Tailwind CSS.

## Table of Contents

- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [Development Guidelines](#development-guidelines)
- [Testing](#testing)
- [Deployment](#deployment)

---

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- Supabase account

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

# Run development server
npm run dev
```

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key
```

---

## Project Structure

```
smart-split/
├── docs/                    # Documentation
│   ├── development/         # Development guides
│   ├── api/                 # API documentation
│   └── guides/              # User guides
├── public/                  # Static assets
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── (auth)/          # Authentication pages
│   │   ├── (dashboard)/     # Protected dashboard pages
│   │   └── auth/callback/   # OAuth callback
│   ├── components/
│   │   ├── ui/              # Reusable UI components
│   │   ├── layout/          # Layout components (Navbar)
│   │   ├── forms/           # Form components
│   │   └── features/        # Feature-specific components
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Utilities and configurations
│   │   └── supabase/        # Supabase client setup
│   ├── services/            # Business logic layer
│   ├── types/               # TypeScript type definitions
│   └── __tests__/           # Jest test files
├── supabase/
│   └── migrations/          # Database migrations
├── .cursorrules             # AI assistant rules (self-evolving)
├── jest.config.ts           # Jest configuration
├── next.config.ts           # Next.js configuration
└── tailwind.config.ts       # Tailwind CSS configuration
```

---

## Architecture

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| Backend | Supabase (PostgreSQL, Auth, Storage) |
| Forms | React Hook Form + Zod |
| Testing | Jest + React Testing Library |
| Icons | Lucide React |

### Design Principles

1. **Server Components First**: Use RSC for data fetching, "use client" only when necessary
2. **Service Layer Pattern**: Business logic lives in `/services`, not components
3. **Type Safety**: Full TypeScript with generated Supabase types
4. **Mobile-First**: Responsive design with Tailwind breakpoints
5. **Dark Mode Ready**: All components support dark mode via `dark:` prefix

### Data Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Page/Layout   │────▶│    Service      │────▶│    Supabase     │
│  (Server Comp)  │     │   (Business)    │     │   (Database)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│   Client Comp   │     │   Server Action │
│   (Interactve)  │────▶│   (Mutations)   │
└─────────────────┘     └─────────────────┘
```

---

## Development Guidelines

### Component Creation

1. Create component in appropriate folder (`/ui`, `/layout`, `/features`)
2. Use CVA for variants
3. Accept `className` prop for customization
4. Use `forwardRef` for DOM element access
5. Create test file in `__tests__/`

### Adding a New Feature

1. Plan database schema changes (if needed)
2. Create Supabase migration
3. Generate types: `npm run db:types`
4. Create service layer in `/services`
5. Create UI components
6. Add tests
7. Update documentation

### Git Workflow

```bash
# Feature branch
git checkout -b feature/group-management

# Commit with conventional commits
git commit -m "feat: add group creation form"
git commit -m "fix: resolve avatar upload issue"
git commit -m "docs: update API documentation"

# Push and create PR
git push origin feature/group-management
```

---

## Testing

### Running Tests

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Generate coverage report
```

### Test Structure

```
src/__tests__/
├── components/
│   └── ui/
│       ├── button.test.tsx
│       ├── input.test.tsx
│       └── card.test.tsx
├── services/
│   └── profile.test.ts
└── lib/
    └── utils.test.ts
```

### Writing Tests

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MyComponent } from "@/components/my-component";

describe("MyComponent", () => {
  it("renders correctly", () => {
    render(<MyComponent />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("handles user interaction", async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    
    render(<MyComponent onClick={onClick} />);
    await user.click(screen.getByRole("button"));
    
    expect(onClick).toHaveBeenCalled();
  });
});
```

---

## NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run Jest tests |
| `npm run test:watch` | Jest in watch mode |
| `npm run test:coverage` | Generate coverage report |

---

## Related Documentation

- [CHANGELOG.md](./CHANGELOG.md) - Version history
- [Architecture](./development/architecture.md) - Detailed architecture
- [Database Schema](./development/database.md) - Database documentation
- [Components](./development/components.md) - Component library
- [API Reference](./api/services.md) - Service layer documentation

---

## Support

For questions or issues:
1. Check existing documentation
2. Review `.cursorrules` for project conventions
3. Create a GitHub issue

