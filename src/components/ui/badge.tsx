import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
    {
        variants: {
            variant: {
                default: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
                primary: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
                success: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
                warning: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
                danger: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
                info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
);

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
    return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };

