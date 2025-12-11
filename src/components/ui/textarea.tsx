"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
    helperText?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ className, label, error, helperText, id, ...props }, ref) => {
        const generatedId = useId();
        const textareaId = id || generatedId;

        return (
            <div className="w-full">
                {label && (
                    <label
                        htmlFor={textareaId}
                        className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200"
                    >
                        {label}
                    </label>
                )}
                <textarea
                    ref={ref}
                    id={textareaId}
                    className={cn(
                        "flex min-h-[100px] w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 transition-colors",
                        "placeholder:text-gray-400",
                        "focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20",
                        "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500",
                        "dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100",
                        "dark:placeholder:text-gray-500",
                        "dark:focus:border-teal-400 dark:focus:ring-teal-400/20",
                        error && "border-red-500 focus:border-red-500 focus:ring-red-500/20",
                        className
                    )}
                    {...props}
                />
                {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}
                {helperText && !error && (
                    <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">{helperText}</p>
                )}
            </div>
        );
    }
);
Textarea.displayName = "Textarea";

export { Textarea };

