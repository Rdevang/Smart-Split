"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    description?: string;
    children: React.ReactNode;
    className?: string;
}

export function Dialog({ open, onClose, title, description, children, className }: DialogProps) {
    // Close on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape" && open) {
                onClose();
            }
        };

        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [open, onClose]);

    // Prevent body scroll when open
    useEffect(() => {
        if (open) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [open]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 transition-opacity"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Dialog */}
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? "dialog-title" : undefined}
                aria-describedby={description ? "dialog-description" : undefined}
                className={cn(
                    "relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900",
                    "animate-in fade-in-0 zoom-in-95 duration-200",
                    className
                )}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                    aria-label="Close dialog"
                >
                    <X className="h-5 w-5" />
                </button>

                {/* Title */}
                {title && (
                    <h2
                        id="dialog-title"
                        className="pr-8 text-lg font-semibold text-gray-900 dark:text-white"
                    >
                        {title}
                    </h2>
                )}

                {/* Description */}
                {description && (
                    <p
                        id="dialog-description"
                        className="mt-2 text-sm text-gray-500 dark:text-gray-400"
                    >
                        {description}
                    </p>
                )}

                {/* Content */}
                <div className={cn(title || description ? "mt-4" : "")}>
                    {children}
                </div>
            </div>
        </div>
    );
}
