/**
 * Root Layout - Smart Split Application
 * Handles global fonts, metadata, analytics, and providers
 */
import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Providers } from "@/components/providers";
import "./globals.css";

// Google Analytics Measurement ID
const GA_MEASUREMENT_ID = "G-2Z3YEP2X2Z";
// Google Tag Manager ID
const GTM_ID = "GTM-NB5TCMVX";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["600", "700"], // Only weights used for headings
  display: "swap",
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"], // Only weights used for body text
  display: "swap",
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
    ],
    apple: [
      { url: "/favicon.svg", type: "image/svg+xml" },
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
        {/* Preconnect to critical origins - reduces connection time by ~100-300ms */}
        <link rel="preconnect" href="https://cizakzarkdgieclbwljy.supabase.co" />
        <link rel="dns-prefetch" href="https://cizakzarkdgieclbwljy.supabase.co" />

        {/* Dark mode initialization - minimal, must stay in head to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('theme')||'system';if(t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')})()`,
          }}
        />
      </head>
      <body
        className={`${plusJakarta.variable} ${inter.variable} font-body antialiased bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100`}
      >
        {/* Google Tag Manager - defer loading to after FCP */}
        <Script id="gtm-init" strategy="lazyOnload">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`}
        </Script>

        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>

        {/* Google Analytics - load after interactive */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="lazyOnload"
        />
        <Script id="google-analytics" strategy="lazyOnload">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_MEASUREMENT_ID}');`}
        </Script>

        <Providers>{children}</Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>


  );
}
