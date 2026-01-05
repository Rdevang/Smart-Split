import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

// ============================================
// SECURITY HEADERS
// ============================================
const securityHeaders = [
  {
    // Prevent clickjacking attacks
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    // Prevent MIME type sniffing
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // Enable XSS filter in browsers
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    // Control referrer information
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // Permissions Policy (formerly Feature-Policy)
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(self), payment=()",
  },
  {
    // Content Security Policy
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://va.vercel-scripts.com https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/", // Required for Next.js + Google Analytics/GTM + Vercel Analytics + reCAPTCHA
      "style-src 'self' 'unsafe-inline'", // Required for Tailwind
      "img-src 'self' data: blob: https://lh3.googleusercontent.com https://avatars.githubusercontent.com https://cizakzarkdgieclbwljy.supabase.co https://www.googletagmanager.com https://www.google-analytics.com https://www.gstatic.com/recaptcha/",
      "font-src 'self'",
      "connect-src 'self' https://cizakzarkdgieclbwljy.supabase.co wss://cizakzarkdgieclbwljy.supabase.co https://*.upstash.io https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://photon.komoot.io https://va.vercel-scripts.com https://vitals.vercel-insights.com https://www.google.com/recaptcha/",
      "frame-src https://www.google.com/recaptcha/ https://recaptcha.google.com/", // Required for reCAPTCHA iframe
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cizakzarkdgieclbwljy.supabase.co",
        pathname: "/storage/**",
      },
    ],
  },

  // Apply security headers and caching to all routes
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Cache static assets aggressively (1 year)
        source: "/(.*)\\.(ico|svg|png|jpg|jpeg|gif|webp|woff|woff2)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Cache landing page at edge (5 minutes, stale-while-revalidate)
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=300, stale-while-revalidate=600",
          },
        ],
      },
      {
        // Cache public pages (login, register, feedback) at edge
        source: "/(login|register|feedback|forgot-password)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=300, stale-while-revalidate=600",
          },
        ],
      },
      {
        // Cache SEO files longer
        source: "/(sitemap.xml|robots.txt|manifest.json)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=3600, stale-while-revalidate=86400",
          },
        ],
      },
      {
        // API health endpoints - short cache
        source: "/api/(health|cache/health)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=10, stale-while-revalidate=30",
          },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
