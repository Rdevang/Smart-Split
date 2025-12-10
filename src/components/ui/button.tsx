import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
    {
        variants: {
            variant: {
                primary:
                    "bg-teal-600 text-white hover:bg-teal-700 focus-visible:ring-teal-500 shadow-sm hover:shadow-md",
                secondary:
                    "bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:ring-gray-500 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700",
                outline:
                    "border-2 border-teal-600 text-teal-600 hover:bg-teal-50 focus-visible:ring-teal-500 dark:border-teal-400 dark:text-teal-400 dark:hover:bg-teal-950",
                ghost:
                    "text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-gray-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100",
                danger:
                    "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 shadow-sm",
                link: "text-teal-600 underline-offset-4 hover:underline focus-visible:ring-teal-500 dark:text-teal-400",
            },
            size: {
                sm: "h-9 px-3 text-xs",
                md: "h-11 px-5 text-sm",
                lg: "h-12 px-8 text-base",
                icon: "h-10 w-10",
            },
        },
        defaultVariants: {
            variant: "primary",
            size: "md",
        },
    }
);

export interface ButtonProps
    extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, isLoading, children, disabled, ...props }, ref) => {
        return (
            <button
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                disabled={disabled || isLoading}
                {...props}
            >
                {isLoading && (
                    <svg
                        className="h-4 w-4 animate-spin"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                    </svg>
                )}
                {children}
            </button>
        );
    }
);

Button.displayName = "Button";

export { Button, buttonVariants };

