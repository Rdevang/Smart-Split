import Link from "next/link";
import { Wallet } from "lucide-react";
import type { Metadata } from "next";
import { AuthTestimonial } from "@/components/features/reviews/auth-testimonial";

export const metadata: Metadata = {
    title: "Sign In",
    description: "Sign in to Smart Split to track and split expenses with your friends and groups.",
    robots: {
        index: true,
        follow: true,
    },
};

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen">
            {/* Left side - Branding */}
            <div className="relative hidden w-1/2 lg:block">
                <div className="absolute inset-0 bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-800">
                    {/* Pattern overlay */}
                    <div
                        className="absolute inset-0 opacity-10"
                        style={{
                            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                        }}
                    />
                    {/* Gradient orbs */}
                    <div className="absolute top-20 left-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
                    <div className="absolute bottom-20 right-20 h-96 w-96 rounded-full bg-teal-400/20 blur-3xl" />
                </div>

                <div className="relative flex h-full flex-col justify-between p-12">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                            <Wallet className="h-6 w-6 text-white" />
                        </div>
                        <span className="text-2xl font-bold text-white">SmartSplit</span>
                    </Link>

                    {/* Testimonial/Quote - Rotating */}
                    <AuthTestimonial />

                    {/* Footer */}
                    <div className="text-sm text-white/50">
                        © {new Date().getFullYear()} SmartSplit. All rights reserved.
                    </div>
                </div>
            </div>

            {/* Right side - Auth form */}
            <div className="flex w-full flex-col lg:w-1/2">
                {/* Mobile logo */}
                <div className="p-6 lg:hidden">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-600">
                            <Wallet className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-xl font-bold text-gray-900 dark:text-white">
                            SmartSplit
                        </span>
                    </Link>
                </div>

                {/* Form container */}
                <div className="flex flex-1 items-center justify-center p-6 sm:p-12">
                    <div className="w-full max-w-md">{children}</div>
                </div>
            </div>
        </div>
    );
}

