import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, label, error, helperText, id, ...props }, ref) => {
        const generatedId = useId();
        const inputId = id || generatedId;

        return (
            <div className="w-full space-y-1.5">
                {label && (
                    <label
                        htmlFor={inputId}
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                        {label}
                    </label>
                )}
                <input
                    type={type}
                    id={inputId}
                    className={cn(
                        "flex h-11 w-full rounded-lg border bg-white px-4 py-2 text-sm text-gray-900 transition-colors",
                        "placeholder:text-gray-400",
                        "focus:outline-none focus:ring-2 focus:ring-offset-0",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                        "dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500",
                        error
                            ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                            : "border-gray-300 focus:border-teal-500 focus:ring-teal-500/20 dark:border-gray-700 dark:focus:border-teal-500",
                        className
                    )}
                    ref={ref}
                    {...props}
                />
                {error && (
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                )}
                {helperText && !error && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{helperText}</p>
                )}
            </div>
        );
    }
);

Input.displayName = "Input";

export { Input };

