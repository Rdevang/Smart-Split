# Smart Split 💰

A modern expense sharing application built with Next.js 16, designed to make splitting bills with friends, roommates, and travel companions effortless.

**Live Demo:** [smart-split-one.vercel.app](https://smart-split-one.vercel.app)

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green?logo=supabase)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss)

## ✨ Features

### 💳 Expense Management

* Create and manage expense groups (trips, roommates, events)
* Add expenses with multiple split options (equal, exact amounts, percentages)
* 10 expense categories with emoji icons
* Track who paid and who owes
* Settlement tracking and payment recording

### 🤖 AI-Powered Features

* **Natural Language Input** - "Paid ₹500 for dinner with John and Sarah"
* **Voice Input** - Speak your expenses using Web Speech API
* **Receipt Scanning** - Upload receipts for automatic parsing
* Smart category suggestions
* Rate limited to 1 AI request per user per day (free tier)

### 📊 Analytics Dashboard

* Total spending overview with time filters (7 days, 30 days, all time)
* Category breakdown (donut chart)
* Spending trends over time (line chart)
* Member contributions (bar chart)
* Settlement status visualization
* Paid vs Share comparison

### 📤 Export Options

* **CSV** - Download for Excel/Numbers
* **Google Sheets** - Copy to clipboard + open Sheets
* **Notion** - Markdown table copied to clipboard
* **PDF** - Printable expense report

### 👥 Group Features

* Create unlimited groups
* Add members by email or as placeholders (non-registered users)
* **QR Code Invites** - Generate QR codes for easy group joining
* Invite links with unique codes
* Admin and member roles
* Group settings and management

### 🔐 Authentication

* Email/Password signup with verification
* Google OAuth
* GitHub OAuth
* Password reset flow
* Session management

### 💸 Settlements

* Smart debt simplification algorithm
* Record payments between members
* Settlement history with timestamps
* Automatic balance updates

### 🎨 User Experience

* Dark/Light mode toggle
* Fully responsive (mobile-first design)
* Navigation progress bar
* Loading skeletons
* Toast notifications
* Optimistic UI updates

### 👤 Profile & Settings

* Profile customization (name, avatar, phone)
* Currency preference (8 currencies supported)
* Email notification preferences
* Security settings (password change)
* UPI ID storage (encrypted)

### 🛡️ Admin Panel

* User management
* Feedback review system
* Rate limit monitoring
* System health checks

### ⚡ Performance

* Redis caching with Upstash
* Request coalescing to prevent cache stampedes
* Rate limiting for DDoS protection
* Gzip compression for large cache entries
* Circuit breaker pattern for graceful degradation
* Optimized database queries

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Styling | Tailwind CSS 4 |
| UI Components | Custom + CVA |
| Charts | Recharts |
| Caching | Upstash Redis |
| AI | Google Gemini API |
| Icons | Lucide React |
| Forms | React Hook Form + Zod |
| Testing | Jest + React Testing Library |

## 🚀 Getting Started

### Prerequisites

* Node.js 18+
* npm/yarn/pnpm
* Supabase account
* (Optional) Upstash Redis account
* (Optional) Google Gemini API key

### Installation

1. Clone the repository:

```bash
git clone https://github.com/Rdevang/Smart-Split.git
cd Smart-Split
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp .env.example .env.local
```

4. Configure your `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Optional - for caching
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token

# Optional - for AI features
GEMINI_API_KEY=your_gemini_api_key
```

5. Run the development server:

```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000)

### Database Setup

Run the Supabase migrations:

```bash
npx supabase db push
```

Or apply migrations from `supabase/migrations/` folder in Supabase dashboard.

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Authentication routes
│   ├── (dashboard)/       # Protected dashboard routes
│   ├── admin/             # Admin panel
│   └── api/               # API routes
├── components/
│   ├── ui/                # Reusable UI components
│   ├── features/          # Feature-specific components
│   └── layout/            # Layout components
├── services/              # Business logic & API calls
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities & configurations
└── types/                 # TypeScript types
```

## 🧪 Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

## 📦 Deployment

Deploy to Vercel:

```bash
npm run build
vercel --prod
```

Remember to set environment variables in Vercel dashboard.

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## 📄 License

This project is licensed under the MIT License.

## 👨‍💻 Author

**Devang Rathod**

* GitHub: [@Rdevang](https://github.com/Rdevang)

---

Built with ❤️ using Next.js and Supabase
