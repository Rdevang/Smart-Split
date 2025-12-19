import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://smart-split-one.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Smart Split - Split Expenses with Friends & Groups",
    template: "%s | Smart Split",
  },
  description:
    "The smartest way to split expenses with roommates, travel buddies, and groups. Track who owes what, simplify debts, and settle up instantly. Free expense sharing app.",
  keywords: [
    "expense sharing",
    "split bills",
    "group expenses",
    "money tracker",
    "splitwise alternative",
    "roommate expenses",
    "travel expenses",
    "debt tracker",
    "bill splitter",
    "shared expenses app",
  ],
  authors: [{ name: "Smart Split Team" }],
  creator: "Smart Split",
  publisher: "Smart Split",
  // Google Search Console verification
  verification: {
    google: "google3e02d7e6ed1b0e91",
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Smart Split",
    title: "Smart Split - Split Expenses with Friends & Groups",
    description:
      "The smartest way to split expenses with roommates, travel buddies, and groups. Track who owes what, simplify debts, and settle up instantly.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Smart Split - Expense Sharing Made Easy",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Smart Split - Split Expenses with Friends & Groups",
    description:
      "The smartest way to split expenses with roommates, travel buddies, and groups. Track who owes what and settle up instantly.",
    images: ["/og-image.png"],
    creator: "@smartsplit",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/manifest.json",
  alternates: {
    canonical: siteUrl,
  },
  category: "finance",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#030712" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const theme = localStorage.getItem('theme') || 'system';
                const isDark = theme === 'dark' || 
                  (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                if (isDark) document.documentElement.classList.add('dark');
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${plusJakarta.variable} ${inter.variable} font-body antialiased bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
