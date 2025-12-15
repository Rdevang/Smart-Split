"use client";

import { createContext, useContext, useState, useCallback, useId } from "react";
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

// Toast variants
const toastVariants = cva(
    "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border p-4 shadow-xl transition-all duration-300 backdrop-blur-none",
    {
        variants: {
            variant: {
                default: "border-gray-200 bg-white text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white",
                success: "border-green-300 bg-green-50 text-green-900 dark:border-green-700 dark:bg-green-950 dark:text-green-100",
                error: "border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-100",
                warning: "border-yellow-300 bg-yellow-50 text-yellow-900 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-100",
                info: "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-100",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
);

const iconMap = {
    default: Info,
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
};

const iconColorMap = {
    default: "text-gray-500 dark:text-gray-400",
    success: "text-green-500 dark:text-green-400",
    error: "text-red-500 dark:text-red-400",
    warning: "text-yellow-500 dark:text-yellow-400",
    info: "text-blue-500 dark:text-blue-400",
};

// Toast types
export type ToastVariant = "default" | "success" | "error" | "warning" | "info";

export interface Toast {
    id: string;
    title?: string;
    message: string;
    variant: ToastVariant;
    duration?: number;
}

interface ToastContextType {
    toasts: Toast[];
    toast: (options: Omit<Toast, "id">) => void;
    success: (message: string, title?: string) => void;
    error: (message: string, title?: string) => void;
    warning: (message: string, title?: string) => void;
    info: (message: string, title?: string) => void;
    dismiss: (id: string) => void;
    dismissAll: () => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
}

interface ToastProviderProps {
    children: React.ReactNode;
    position?: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top-center" | "bottom-center";
}

const positionClasses = {
    "top-right": "top-4 right-4",
    "top-left": "top-4 left-4",
    "bottom-right": "bottom-4 right-4",
    "bottom-left": "bottom-4 left-4",
    "top-center": "top-4 left-1/2 -translate-x-1/2",
    "bottom-center": "bottom-4 left-1/2 -translate-x-1/2",
};

export function ToastProvider({ children, position = "top-right" }: ToastProviderProps) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const toastIdPrefix = useId();
    let toastCounter = 0;

    const dismiss = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const dismissAll = useCallback(() => {
        setToasts([]);
    }, []);

    const addToast = useCallback((options: Omit<Toast, "id">) => {
        const id = `${toastIdPrefix}-${++toastCounter}-${Date.now()}`;
        const duration = options.duration ?? 5000;

        setToasts((prev) => [...prev, { ...options, id }]);

        if (duration > 0) {
            setTimeout(() => {
                dismiss(id);
            }, duration);
        }

        return id;
    }, [toastIdPrefix, dismiss]);

    const toast = useCallback((options: Omit<Toast, "id">) => {
        addToast(options);
    }, [addToast]);

    const success = useCallback((message: string, title?: string) => {
        addToast({ message, title, variant: "success" });
    }, [addToast]);

    const error = useCallback((message: string, title?: string) => {
        addToast({ message, title, variant: "error" });
    }, [addToast]);

    const warning = useCallback((message: string, title?: string) => {
        addToast({ message, title, variant: "warning" });
    }, [addToast]);

    const info = useCallback((message: string, title?: string) => {
        addToast({ message, title, variant: "info" });
    }, [addToast]);

    return (
        <ToastContext.Provider value={{ toasts, toast, success, error, warning, info, dismiss, dismissAll }}>
            {children}
            {/* Toast Container */}
            <div
                className={cn(
                    "fixed z-[9999] flex flex-col gap-2 pointer-events-none",
                    positionClasses[position]
                )}
                role="region"
                aria-label="Notifications"
            >
                {toasts.map((t) => {
                    const Icon = iconMap[t.variant];
                    return (
                        <div
                            key={t.id}
                            className={cn(toastVariants({ variant: t.variant }))}
                            role="alert"
                        >
                            <Icon className={cn("h-5 w-5 flex-shrink-0 mt-0.5", iconColorMap[t.variant])} />
                            <div className="flex-1 min-w-0">
                                {t.title && (
                                    <p className="font-semibold text-sm">{t.title}</p>
                                )}
                                <p className={cn("text-sm", t.title && "mt-1 opacity-90")}>
                                    {t.message}
                                </p>
                            </div>
                            <button
                                onClick={() => dismiss(t.id)}
                                className="flex-shrink-0 rounded-md p-1 opacity-70 hover:opacity-100 transition-opacity"
                                aria-label="Dismiss notification"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
}

