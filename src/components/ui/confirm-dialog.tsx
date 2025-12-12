"use client";

import { useEffect, useRef } from "react";
import { X, AlertTriangle, Trash2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

type DialogVariant = "danger" | "warning" | "info";

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: DialogVariant;
    isLoading?: boolean;
}

const variantConfig = {
    danger: {
        icon: Trash2,
        iconBg: "bg-red-100 dark:bg-red-900/30",
        iconColor: "text-red-600 dark:text-red-400",
        buttonVariant: "danger" as const,
    },
    warning: {
        icon: AlertTriangle,
        iconBg: "bg-yellow-100 dark:bg-yellow-900/30",
        iconColor: "text-yellow-600 dark:text-yellow-400",
        buttonVariant: "primary" as const,
    },
    info: {
        icon: AlertCircle,
        iconBg: "bg-blue-100 dark:bg-blue-900/30",
        iconColor: "text-blue-600 dark:text-blue-400",
        buttonVariant: "primary" as const,
    },
};

export function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = "danger",
    isLoading = false,
}: ConfirmDialogProps) {
    const dialogRef = useRef<HTMLDivElement>(null);
    const config = variantConfig[variant];
    const Icon = config.icon;

    // Close on escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen && !isLoading) {
                onClose();
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, isLoading, onClose]);

    // Prevent scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    // Focus trap
    useEffect(() => {
        if (isOpen && dialogRef.current) {
            dialogRef.current.focus();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={isLoading ? undefined : onClose}
                aria-hidden="true"
            />

            {/* Dialog */}
            <div
                ref={dialogRef}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="dialog-title"
                aria-describedby="dialog-message"
                tabIndex={-1}
                className="fixed left-1/2 top-1/2 z-[9999] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800"
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    disabled={isLoading}
                    className="absolute right-4 top-4 rounded-md p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 dark:hover:text-gray-300"
                    aria-label="Close dialog"
                >
                    <X className="h-5 w-5" />
                </button>

                {/* Content */}
                <div className="flex flex-col items-center text-center">
                    {/* Icon */}
                    <div className={cn("flex h-12 w-12 items-center justify-center rounded-full", config.iconBg)}>
                        <Icon className={cn("h-6 w-6", config.iconColor)} />
                    </div>

                    {/* Title */}
                    <h2
                        id="dialog-title"
                        className="mt-4 text-lg font-semibold text-gray-900 dark:text-white"
                    >
                        {title}
                    </h2>

                    {/* Message */}
                    <p
                        id="dialog-message"
                        className="mt-2 text-sm text-gray-600 dark:text-gray-400"
                    >
                        {message}
                    </p>
                </div>

                {/* Actions */}
                <div className="mt-6 flex gap-3">
                    <Button
                        variant="outline"
                        className="flex-1"
                        onClick={onClose}
                        disabled={isLoading}
                    >
                        {cancelText}
                    </Button>
                    <Button
                        variant={config.buttonVariant}
                        className="flex-1"
                        onClick={onConfirm}
                        isLoading={isLoading}
                    >
                        {confirmText}
                    </Button>
                </div>
            </div>
        </>
    );
}

