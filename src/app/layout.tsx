import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Smart Split - Split Expenses with Friends",
  description:
    "The easiest way to share expenses with friends and family. Track balances, split bills, and settle up effortlessly.",
  keywords: ["expense sharing", "split bills", "group expenses", "money tracker"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body
        className={`${plusJakarta.variable} ${inter.variable} font-body antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
