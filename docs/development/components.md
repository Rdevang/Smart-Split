# Component Library

> Last Updated: 2024-12-10

## Overview

Smart Split uses a custom component library built with:
- **Tailwind CSS** for styling
- **CVA (Class Variance Authority)** for variants
- **forwardRef** for ref forwarding
- **TypeScript** for type safety

All components are located in `src/components/`.

---

## UI Components (`src/components/ui/`)

### Button

A versatile button component with multiple variants and sizes.

```tsx
import { Button } from "@/components/ui";

// Basic usage
<Button>Click me</Button>

// Variants
<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="danger">Danger</Button>
<Button variant="link">Link</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Icon /></Button>

// States
<Button isLoading>Loading...</Button>
<Button disabled>Disabled</Button>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| variant | `"primary" \| "secondary" \| "outline" \| "ghost" \| "danger" \| "link"` | `"primary"` | Button style variant |
| size | `"sm" \| "md" \| "lg" \| "icon"` | `"md"` | Button size |
| isLoading | `boolean` | `false` | Shows loading spinner |
| disabled | `boolean` | `false` | Disables the button |
| className | `string` | - | Additional CSS classes |
| children | `ReactNode` | - | Button content |

---

### Input

A text input component with label, error, and helper text support.

```tsx
import { Input } from "@/components/ui";

// Basic usage
<Input placeholder="Enter text" />

// With label
<Input label="Email" type="email" />

// With error
<Input label="Password" error="Password is required" />

// With helper text
<Input label="Username" helperText="Choose a unique username" />

// Disabled
<Input label="Read only" disabled value="Can't edit" />
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| label | `string` | - | Input label |
| error | `string` | - | Error message |
| helperText | `string` | - | Helper text (hidden when error) |
| type | `string` | `"text"` | Input type |
| className | `string` | - | Additional CSS classes |
| ...props | `InputHTMLAttributes` | - | All HTML input props |

---

### Card

A card component family for content containers.

```tsx
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui";

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description text</CardDescription>
  </CardHeader>
  <CardContent>
    Main content goes here
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

#### Components

| Component | Description |
|-----------|-------------|
| `Card` | Container with border and shadow |
| `CardHeader` | Header section with padding |
| `CardTitle` | Title (h3) |
| `CardDescription` | Subtitle/description |
| `CardContent` | Main content area |
| `CardFooter` | Footer with flex layout |

---

## Layout Components (`src/components/layout/`)

### Navbar

The main navigation bar with profile dropdown.

```tsx
import { Navbar } from "@/components/layout";

<Navbar
  user={{
    id: "user-123",
    email: "user@example.com",
    full_name: "John Doe",
    avatar_url: "https://...",
  }}
/>
```

#### Features
- Logo with SmartSplit branding
- Navigation links (Dashboard, Groups, Expenses, Activity)
- Active state highlighting
- Profile dropdown with:
  - User avatar/initials
  - User name and email
  - Settings links
  - Sign out button
- Mobile responsive hamburger menu

#### Props

| Prop | Type | Description |
|------|------|-------------|
| user.id | `string` | User ID |
| user.email | `string` | User email |
| user.full_name | `string \| null` | Display name |
| user.avatar_url | `string \| null` | Avatar URL |

---

## Form Components (`src/components/forms/`)

*Coming soon*

- LoginForm
- RegisterForm
- ExpenseForm
- GroupForm

---

## Feature Components (`src/components/features/`)

*Coming soon*

- ExpenseCard
- GroupCard
- ActivityItem
- BalanceCard

---

## Styling Patterns

### Using the `cn()` Utility

Merge Tailwind classes without conflicts:

```tsx
import { cn } from "@/lib/utils";

// Merge classes
cn("p-4", "p-2") // → "p-2" (last wins)

// Conditional classes
cn("base-class", isActive && "active-class")

// With className prop
cn(buttonVariants({ variant }), className)
```

### Creating Variants with CVA

```tsx
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  // Base classes
  "inline-flex items-center justify-center rounded-lg font-medium",
  {
    variants: {
      variant: {
        primary: "bg-teal-600 text-white hover:bg-teal-700",
        secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
      },
      size: {
        sm: "h-9 px-3 text-xs",
        md: "h-11 px-5 text-sm",
        lg: "h-12 px-8 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

interface ButtonProps extends VariantProps<typeof buttonVariants> {}
```

### Dark Mode Support

All components support dark mode via Tailwind's `dark:` prefix:

```tsx
<div className="bg-white dark:bg-gray-900">
  <p className="text-gray-900 dark:text-gray-100">
    Works in both modes
  </p>
</div>
```

---

## Testing Components

Every component should have tests:

```tsx
// src/__tests__/components/ui/button.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button")).toHaveTextContent("Click me");
  });

  it("handles click events", async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    
    render(<Button onClick={onClick}>Click</Button>);
    await user.click(screen.getByRole("button"));
    
    expect(onClick).toHaveBeenCalled();
  });

  it("shows loading state", () => {
    render(<Button isLoading>Loading</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
```

---

## Adding New Components

1. Create component file in appropriate folder
2. Use CVA for variants (if applicable)
3. Accept `className` prop for customization
4. Use `forwardRef` for DOM access
5. Add to barrel export (`index.ts`)
6. Create test file
7. Document in this file

