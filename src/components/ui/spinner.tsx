import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const spinnerVariants = cva(
    "animate-spin rounded-full border-current border-t-transparent",
    {
        variants: {
            size: {
                sm: "h-4 w-4 border-2",
                md: "h-6 w-6 border-2",
                lg: "h-8 w-8 border-3",
                xl: "h-12 w-12 border-4",
            },
            variant: {
                default: "text-teal-500",
                muted: "text-gray-400 dark:text-gray-600",
                white: "text-white",
            },
        },
        defaultVariants: {
            size: "md",
            variant: "default",
        },
    }
);

interface SpinnerProps
    extends React.HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof spinnerVariants> {
    label?: string;
}

export function Spinner({ size, variant, label, className, ...props }: SpinnerProps) {
    return (
        <div
            role="status"
            aria-label={label || "Loading"}
            className={cn("inline-flex items-center justify-center", className)}
            {...props}
        >
            <div className={cn(spinnerVariants({ size, variant }))} />
            {label && (
                <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                    {label}
                </span>
            )}
            <span className="sr-only">{label || "Loading..."}</span>
        </div>
    );
}

