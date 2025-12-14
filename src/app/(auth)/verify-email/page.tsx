"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Mail, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

function VerifyEmailContent() {
    const searchParams = useSearchParams();
    const email = searchParams.get("email");

    return (
        <div className="flex min-h-screen items-center justify-center p-4">
            <div className="w-full max-w-md text-center">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900/30">
                    <Mail className="h-8 w-8 text-teal-600 dark:text-teal-400" />
                </div>
                
                <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
                    Check your email
                </h1>
                
                <p className="mb-6 text-gray-600 dark:text-gray-400">
                    We&apos;ve sent a verification link to{" "}
                    {email ? (
                        <span className="font-medium text-gray-900 dark:text-white">{email}</span>
                    ) : (
                        "your email address"
                    )}
                    . Click the link in the email to verify your account.
                </p>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
                    <h3 className="mb-2 text-sm font-medium text-gray-900 dark:text-white">
                        Didn&apos;t receive the email?
                    </h3>
                    <ul className="text-left text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        <li>• Check your spam or junk folder</li>
                        <li>• Make sure you entered the correct email</li>
                        <li>• Wait a few minutes and try again</li>
                    </ul>
                </div>

                <div className="mt-6">
                    <Link href="/login">
                        <Button variant="ghost" className="gap-2">
                            <ArrowLeft className="h-4 w-4" />
                            Back to login
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={
            <div className="flex min-h-screen items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
            </div>
        }>
            <VerifyEmailContent />
        </Suspense>
    );
}

