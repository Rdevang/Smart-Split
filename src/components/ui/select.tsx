"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

export interface SelectOption {
    value: string;
    label: string;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
    options: SelectOption[];
    label?: string;
    error?: string;
    helperText?: string;
    placeholder?: string;
    onChange?: (value: string) => void;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
    ({ className, options, label, error, helperText, placeholder, onChange, id, ...props }, ref) => {
        const generatedId = useId();
        const selectId = id || generatedId;

        return (
            <div className="w-full">
                {label && (
                    <label
                        htmlFor={selectId}
                        className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200"
                    >
                        {label}
                    </label>
                )}
                <div className="relative">
                    <select
                        ref={ref}
                        id={selectId}
                        className={cn(
                            "flex h-12 w-full appearance-none rounded-lg border border-gray-300 bg-white px-4 py-2 pr-10 text-base text-gray-900 transition-colors",
                            "placeholder:text-gray-400",
                            "focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20",
                            "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500",
                            "dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100",
                            "dark:focus:border-teal-400 dark:focus:ring-teal-400/20",
                            error && "border-red-500 focus:border-red-500 focus:ring-red-500/20",
                            className
                        )}
                        onChange={(e) => onChange?.(e.target.value)}
                        {...props}
                    >
                        {placeholder && (
                            <option value="" disabled>
                                {placeholder}
                            </option>
                        )}
                        {options.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                </div>
                {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}
                {helperText && !error && (
                    <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">{helperText}</p>
                )}
            </div>
        );
    }
);
Select.displayName = "Select";

export { Select };

