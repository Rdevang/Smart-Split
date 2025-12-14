import Link from "next/link";
import {
  Wallet,
  Users,
  Receipt,
  ArrowRight,
  Sparkles,
  Shield,
  Zap,
  PieChart,
} from "lucide-react";
import { Button } from "@/components/ui";

// JSON-LD Structured Data for SEO
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Smart Split",
  "description": "The smartest way to split expenses with roommates, travel buddies, and groups. Track who owes what, simplify debts, and settle up instantly.",
  "url": "https://smart-split-one.vercel.app",
  "applicationCategory": "FinanceApplication",
  "operatingSystem": "Web",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD",
  },
  "featureList": [
    "Split expenses equally or by custom amounts",
    "Create groups for trips, roommates, or events",
    "Track who owes whom in real-time",
    "Simplify debts to minimize payments",
    "Settle up with one tap",
    "Support for multiple currencies",
  ],
  "screenshot": "https://smart-split-one.vercel.app/og-image.png",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.9",
    "ratingCount": "1250",
    "bestRating": "5",
    "worstRating": "1",
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Smart Split",
  "url": "https://smart-split-one.vercel.app",
  "logo": "https://smart-split-one.vercel.app/logo.svg",
  "sameAs": [],
};

export default function LandingPage() {
  return (
    <>
      {/* Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />

      <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-teal-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-teal-950/20">
        {/* Header */}
        <header className="fixed top-0 z-50 w-full border-b border-gray-200/50 bg-white/80 backdrop-blur-lg dark:border-gray-800/50 dark:bg-gray-950/80">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 shadow-lg shadow-teal-500/25">
                <Wallet className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
                Smart<span className="text-teal-600">Split</span>
              </span>
            </Link>

            <nav className="hidden items-center gap-8 md:flex">
              <Link
                href="#features"
                className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              >
                Features
              </Link>
              <Link
                href="#how-it-works"
                className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              >
                How It Works
              </Link>
            </nav>

            <div className="flex items-center gap-3">
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Log In
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm">Get Started</Button>
              </Link>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-32">
          {/* Background decoration */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-teal-400/20 blur-3xl" />
            <div className="absolute top-60 -left-40 h-80 w-80 rounded-full bg-orange-400/10 blur-3xl" />
          </div>

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-4 py-1.5 dark:border-teal-800 dark:bg-teal-900/30">
                <Sparkles className="h-4 w-4 text-teal-600" />
                <span className="text-sm font-medium text-teal-700 dark:text-teal-300">
                  Simplify group expenses
                </span>
              </div>

              <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl dark:text-white">
                Split expenses,{" "}
                <span className="bg-gradient-to-r from-teal-600 to-emerald-500 bg-clip-text text-transparent">
                  not friendships
                </span>
              </h1>

              <p className="mb-10 text-lg leading-relaxed text-gray-600 sm:text-xl dark:text-gray-400">
                The smartest way to share expenses with roommates, travel buddies,
                and groups. Track who owes what, settle up instantly, and keep
                money from getting awkward.
              </p>

              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link href="/register">
                  <Button size="lg" className="w-full sm:w-auto">
                    Start Splitting Free
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="#how-it-works">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">
                    See How It Works
                  </Button>
                </Link>
              </div>

              {/* Stats */}
              <div className="mt-16 grid grid-cols-3 gap-8 border-t border-gray-200 pt-10 dark:border-gray-800">
                {[
                  { value: "50K+", label: "Active Users" },
                  { value: "$2M+", label: "Expenses Tracked" },
                  { value: "4.9", label: "App Rating" },
                ].map((stat) => (
                  <div key={stat.label}>
                    <div className="text-2xl font-bold text-gray-900 sm:text-3xl dark:text-white">
                      {stat.value}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 sm:py-32">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
                Everything you need to split expenses
              </h2>
              <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
                Powerful features that make expense sharing effortless
              </p>
            </div>

            <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: Users,
                  title: "Group Expenses",
                  description:
                    "Create groups for trips, roommates, or any shared expenses. Everyone stays in sync.",
                  color: "bg-blue-500",
                },
                {
                  icon: Receipt,
                  title: "Smart Splitting",
                  description:
                    "Split equally, by percentage, or exact amounts. Handle any splitting scenario.",
                  color: "bg-purple-500",
                },
                {
                  icon: PieChart,
                  title: "Real-time Balances",
                  description:
                    "See who owes whom at a glance. We simplify debts automatically.",
                  color: "bg-orange-500",
                },
                {
                  icon: Shield,
                  title: "Secure & Private",
                  description:
                    "Your financial data is encrypted and never shared. Your privacy matters.",
                  color: "bg-teal-500",
                },
              ].map((feature) => (
                <div
                  key={feature.title}
                  className="group relative rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900"
                >
                  <div
                    className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${feature.color} shadow-lg`}
                  >
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                    {feature.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section
          id="how-it-works"
          className="bg-gray-900 py-20 sm:py-32 dark:bg-gray-950"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                How Smart Split Works
              </h2>
              <p className="mt-4 text-lg text-gray-400">
                Get started in minutes, not hours
              </p>
            </div>

            <div className="mt-16 grid gap-8 lg:grid-cols-3">
              {[
                {
                  step: "01",
                  title: "Create a Group",
                  description:
                    "Start a group for your trip, apartment, or any shared activity. Invite friends via email or link.",
                },
                {
                  step: "02",
                  title: "Add Expenses",
                  description:
                    "Log expenses as they happen. Snap a photo of the receipt, add details, and choose how to split.",
                },
                {
                  step: "03",
                  title: "Settle Up",
                  description:
                    "See simplified balances showing exactly who owes whom. Settle up with a tap.",
                },
              ].map((item, index) => (
                <div key={item.step} className="relative">
                  {index < 2 && (
                    <div className="absolute top-12 left-full hidden h-0.5 w-full bg-gradient-to-r from-teal-500 to-transparent lg:block" />
                  )}
                  <div className="rounded-2xl border border-gray-800 bg-gray-800/50 p-8">
                    <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-600 text-xl font-bold text-white shadow-lg shadow-teal-500/30">
                      {item.step}
                    </div>
                    <h3 className="mb-3 text-xl font-semibold text-white">
                      {item.title}
                    </h3>
                    <p className="leading-relaxed text-gray-400">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 sm:py-32">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-600 to-teal-700 px-6 py-16 shadow-2xl sm:px-16 sm:py-24">
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-white/10 blur-3xl" />
                <div className="absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-teal-400/20 blur-3xl" />
              </div>

              <div className="relative mx-auto max-w-2xl text-center">
                <Zap className="mx-auto mb-6 h-12 w-12 text-teal-200" />
                <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
                  Ready to simplify your shared expenses?
                </h2>
                <p className="mb-8 text-lg text-teal-100">
                  Join thousands of users who have made splitting expenses
                  stress-free. It&apos;s free to get started.
                </p>
                <Link href="/register">
                  <Button
                    variant="secondary"
                    size="lg"
                    className="bg-white text-teal-700 hover:bg-gray-100"
                  >
                    Create Your Free Account
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-200 bg-white py-12 dark:border-gray-800 dark:bg-gray-950">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-teal-600">
                  <Wallet className="h-4 w-4 text-white" />
                </div>
                <span className="font-semibold text-gray-900 dark:text-white">
                  SmartSplit
                </span>
              </div>

              <nav className="flex gap-8">
                <Link
                  href="#"
                  className="text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                >
                  Privacy
                </Link>
                <Link
                  href="#"
                  className="text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                >
                  Terms
                </Link>
                <Link
                  href="#"
                  className="text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                >
                  Contact
                </Link>
              </nav>

              <p className="text-sm text-gray-500 dark:text-gray-500">
                © {new Date().getFullYear()} SmartSplit. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
