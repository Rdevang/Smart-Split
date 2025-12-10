# UI/UX Design Specifications

## Design System

### Color Palette

```css
/* Primary - Teal/Green (Trust, Money, Balance) */
--primary-50: #f0fdfa;
--primary-100: #ccfbf1;
--primary-200: #99f6e4;
--primary-300: #5eead4;
--primary-400: #2dd4bf;
--primary-500: #14b8a6;  /* Main primary */
--primary-600: #0d9488;
--primary-700: #0f766e;
--primary-800: #115e59;
--primary-900: #134e4a;

/* Accent - Coral (Actions, CTAs) */
--accent-500: #f97316;

/* Semantic Colors */
--success: #22c55e;  /* You are owed */
--danger: #ef4444;   /* You owe */
--warning: #eab308;
--info: #3b82f6;

/* Neutrals */
--gray-50: #fafafa;
--gray-900: #0a0a0a;
```

### Typography

- **Headings**: "Plus Jakarta Sans" - Modern, geometric, professional
- **Body**: "Inter" - Highly readable, neutral
- **Monospace**: "JetBrains Mono" - For amounts/numbers

### Component Specifications

#### Buttons

| Variant | Use Case |
|---------|----------|
| Primary | Main actions (Add Expense, Settle Up) |
| Secondary | Secondary actions (Cancel, Back) |
| Ghost | Tertiary actions (Edit, Delete) |
| Danger | Destructive actions |

#### Cards

- Border radius: 12px (rounded-xl)
- Shadow: sm for default, md on hover
- Padding: 16px-24px

#### Forms

- Input height: 44px
- Border radius: 8px
- Focus ring: Primary color

## Page Layouts

### Landing Page Structure

```
┌─────────────────────────────────────────────────────┐
│  HEADER (Logo + Nav + CTA)                          │
├─────────────────────────────────────────────────────┤
│                                                     │
│  HERO SECTION                                       │
│  - Headline                                         │
│  - Subheadline                                      │
│  - CTA Buttons                                      │
│  - Hero Image/Illustration                          │
│                                                     │
├─────────────────────────────────────────────────────┤
│  FEATURES SECTION (3-4 feature cards)               │
├─────────────────────────────────────────────────────┤
│  HOW IT WORKS (3 steps)                             │
├─────────────────────────────────────────────────────┤
│  TESTIMONIALS                                       │
├─────────────────────────────────────────────────────┤
│  CTA SECTION                                        │
├─────────────────────────────────────────────────────┤
│  FOOTER                                             │
└─────────────────────────────────────────────────────┘
```

### Auth Pages Structure

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│   ┌─────────────────────────────────────────────┐   │
│   │                                             │   │
│   │  LOGO                                       │   │
│   │                                             │   │
│   │  Form Title                                 │   │
│   │                                             │   │
│   │  ┌─────────────────────────────────────┐   │   │
│   │  │  Email Input                        │   │   │
│   │  └─────────────────────────────────────┘   │   │
│   │  ┌─────────────────────────────────────┐   │   │
│   │  │  Password Input                     │   │   │
│   │  └─────────────────────────────────────┘   │   │
│   │                                             │   │
│   │  [Submit Button]                            │   │
│   │                                             │   │
│   │  OAuth Divider                              │   │
│   │                                             │   │
│   │  [Google] [GitHub]                          │   │
│   │                                             │   │
│   │  Link to other auth page                    │   │
│   │                                             │   │
│   └─────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Responsive Breakpoints

| Breakpoint | Size | Target |
|------------|------|--------|
| sm | 640px | Large phones |
| md | 768px | Tablets |
| lg | 1024px | Laptops |
| xl | 1280px | Desktops |
| 2xl | 1536px | Large screens |

## Animation Guidelines

- Duration: 150-300ms for micro-interactions
- Easing: ease-out for entrances, ease-in for exits
- Use subtle transforms (scale, translate)
- Avoid animating layout properties

## Accessibility

- Minimum touch target: 44x44px
- Color contrast: WCAG AA (4.5:1 for text)
- Focus indicators on all interactive elements
- Semantic HTML structure
- ARIA labels where needed

