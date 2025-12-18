# 💰 Smart Split

> **The smartest way to split expenses with friends, roommates, and groups.**

[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel)](https://smart-split-one.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-Database-green?logo=supabase)](https://supabase.com)

---

## ✨ Features

- 👥 **Group Management** - Create groups for trips, roommates, couples, or events
- 💸 **Expense Tracking** - Track who paid what with support for equal, exact, and percentage splits
- 📊 **Analytics** - Visualize spending with charts (category breakdown, trends, contributions)
- 🔄 **Smart Settlements** - Simplified debt calculations to minimize payments
- 📱 **QR Code Sharing** - Instantly invite friends by scanning a QR code
- 🌙 **Dark Mode** - Beautiful UI that adapts to your system preference
- 🔐 **Secure** - Enterprise-grade security with CSRF protection, rate limiting, and more

---

## 🚀 Live Demo

**Production:** [https://smart-split-one.vercel.app](https://smart-split-one.vercel.app)

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 16, React 19, TypeScript |
| **Styling** | Tailwind CSS 4 |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth (Email, Google, GitHub) |
| **Caching** | Upstash Redis |
| **Forms** | React Hook Form + Zod |
| **Charts** | Recharts |
| **Testing** | Jest + React Testing Library |
| **Deployment** | Vercel |

---

## 📦 Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- [Supabase](https://supabase.com) account (free tier works)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Rdevang/Smart-Split.git
cd Smart-Split

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local

# 4. Edit .env.local with your credentials
# (See Environment Variables section below)

# 5. Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

---

## 🔐 Environment Variables

Create a `.env.local` file with:

```env
# Required - Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key

# Required - Site URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Optional - Redis (for caching/rate limiting)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# Optional - Cron jobs (production only)
CRON_SECRET=your-secret-for-cron-jobs
```

Get Supabase credentials from your [Supabase Dashboard](https://supabase.com/dashboard).

---

## 📁 Project Structure

```
smart-split/
├── docs/                    # Documentation
│   ├── security/            # Security audit & guides
│   ├── development/         # Development guides
│   └── api/                 # API documentation
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── (auth)/          # Auth pages (login, register)
│   │   ├── (dashboard)/     # Protected pages (groups, expenses)
│   │   └── api/             # API routes
│   ├── components/          # React components
│   │   ├── ui/              # Base components (Button, Card)
│   │   ├── layout/          # Layout components (Navbar)
│   │   └── features/        # Feature components (GroupCard)
│   ├── services/            # Business logic layer
│   ├── lib/                 # Utilities (Supabase, validation)
│   └── types/               # TypeScript definitions
├── supabase/
│   └── migrations/          # Database migrations
└── .cursorrules             # AI assistant configuration
```

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

---

## 📜 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests |
| `npm run test:coverage` | Test with coverage |
| `npm run analyze` | Analyze bundle size |

---

## 🔒 Security

Smart Split implements comprehensive security measures:

- ✅ CSRF protection on all auth actions
- ✅ Rate limiting (API, auth, financial operations)
- ✅ Input validation & XSS sanitization
- ✅ Row-Level Security (RLS) on all database tables
- ✅ Secure session management
- ✅ PII redaction in logs
- ✅ Security headers (CSP, X-Frame-Options, etc.)

See [docs/security/SECURITY_AUDIT.md](docs/security/SECURITY_AUDIT.md) for the full security audit.

---

## 🗄️ Database Schema

Key tables:

| Table | Description |
|-------|-------------|
| `profiles` | User profiles |
| `groups` | Expense sharing groups |
| `group_members` | Group membership |
| `expenses` | Individual expenses |
| `expense_splits` | Who owes what |
| `settlements` | Payment records |
| `activities` | Activity feed |

See [docs/development/database.md](docs/development/database.md) for full schema.

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please read the [contribution guidelines](docs/CONTRIBUTING.md) first.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org) - The React Framework
- [Supabase](https://supabase.com) - Open source Firebase alternative
- [Tailwind CSS](https://tailwindcss.com) - Utility-first CSS framework
- [Vercel](https://vercel.com) - Deployment platform
- [Lucide](https://lucide.dev) - Beautiful icons

---

## 📞 Support

- 📧 Create a [GitHub Issue](https://github.com/Rdevang/Smart-Split/issues)
- 📖 Check the [Documentation](docs/README.md)
- 💬 Use the in-app [Feedback](https://smart-split-one.vercel.app/feedback) feature

---

<p align="center">Made with ❤️ by <a href="https://github.com/Rdevang">Devang Rathod</a></p>
