"use client";

import Link from "next/link";
import { MessageSquarePlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeedbackButtonProps {
    className?: string;
    variant?: "floating" | "inline";
}

export function FeedbackButton({ className, variant = "floating" }: FeedbackButtonProps) {
    if (variant === "inline") {
        return (
            <Link
                href="/feedback"
                className={cn(
                    "inline-flex items-center gap-2 text-sm text-gray-500 hover:text-teal-600 dark:text-gray-400 dark:hover:text-teal-400 transition-colors",
                    className
                )}
            >
                <MessageSquarePlus className="h-4 w-4" />
                Feedback
            </Link>
        );
    }

    return (
        <Link
            href="/feedback"
            className={cn(
                "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-lg transition-all hover:scale-110 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900",
                className
            )}
            title="Share Feedback"
        >
            <MessageSquarePlus className="h-6 w-6" />
            <span className="sr-only">Share Feedback</span>
        </Link>
    );
}

