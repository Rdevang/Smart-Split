/**
 * Skeleton Components
 * 
 * Reusable loading placeholder components for building loading states.
 * Use these in loading.tsx files and Suspense fallbacks.
 * 
 * USAGE:
 *   import { Skeleton, SkeletonText, SkeletonCard, SkeletonAvatar } from "@/components/ui/skeleton";
 *   
 *   // Basic rectangle
 *   <Skeleton className="h-8 w-32" />
 *   
 *   // Text lines
 *   <SkeletonText lines={3} />
 *   
 *   // Card placeholder
 *   <SkeletonCard />
 *   
 *   // Avatar placeholder
 *   <SkeletonAvatar size="lg" />
 */

import { cn } from "@/lib/utils";

// ============================================
// BASE SKELETON
// ============================================

interface SkeletonProps {
    className?: string;
}

/**
 * Base skeleton component - a simple animated placeholder rectangle
 * Use className to set width/height as needed
 */
export function Skeleton({ className }: SkeletonProps) {
    return (
        <div
            className={cn(
                "animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800",
                className
            )}
        />
    );
}

// ============================================
// SKELETON TEXT
// ============================================

interface SkeletonTextProps {
    /** Number of lines to render */
    lines?: number;
    /** Make the last line shorter */
    shortLastLine?: boolean;
    /** Gap between lines */
    gap?: "sm" | "md" | "lg";
    className?: string;
}

/**
 * Skeleton text - renders multiple line placeholders
 */
export function SkeletonText({
    lines = 3,
    shortLastLine = true,
    gap = "sm",
    className,
}: SkeletonTextProps) {
    const gapClass = {
        sm: "space-y-2",
        md: "space-y-3",
        lg: "space-y-4",
    }[gap];

    return (
        <div className={cn(gapClass, className)}>
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    key={i}
                    className={cn(
                        "h-4",
                        shortLastLine && i === lines - 1 ? "w-3/4" : "w-full"
                    )}
                />
            ))}
        </div>
    );
}

// ============================================
// SKELETON AVATAR
// ============================================

interface SkeletonAvatarProps {
    /** Size of the avatar */
    size?: "sm" | "md" | "lg" | "xl";
    /** Shape of the avatar */
    shape?: "circle" | "rounded";
    className?: string;
}

/**
 * Skeleton avatar - circular or rounded placeholder for avatars
 */
export function SkeletonAvatar({
    size = "md",
    shape = "circle",
    className,
}: SkeletonAvatarProps) {
    const sizeClass = {
        sm: "h-8 w-8",
        md: "h-10 w-10",
        lg: "h-12 w-12",
        xl: "h-16 w-16",
    }[size];

    const shapeClass = shape === "circle" ? "rounded-full" : "rounded-xl";

    return (
        <div
            className={cn(
                "animate-pulse bg-gray-200 dark:bg-gray-800",
                sizeClass,
                shapeClass,
                className
            )}
        />
    );
}

// ============================================
// SKELETON CARD
// ============================================

interface SkeletonCardProps {
    /** Show avatar placeholder */
    withAvatar?: boolean;
    /** Number of text lines */
    textLines?: number;
    /** Show action button placeholder */
    withAction?: boolean;
    className?: string;
}

/**
 * Skeleton card - complete card placeholder with avatar, text, and optional action
 */
export function SkeletonCard({
    withAvatar = true,
    textLines = 2,
    withAction = false,
    className,
}: SkeletonCardProps) {
    return (
        <div
            className={cn(
                "animate-pulse rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900",
                className
            )}
        >
            <div className="flex items-start gap-4">
                {withAvatar && <SkeletonAvatar size="lg" shape="rounded" />}
                <div className="flex-1 space-y-2">
                    {Array.from({ length: textLines }).map((_, i) => (
                        <Skeleton
                            key={i}
                            className={cn("h-4", i === 0 ? "w-3/4" : "w-1/2")}
                        />
                    ))}
                </div>
                {withAction && <Skeleton className="h-9 w-20" />}
            </div>
        </div>
    );
}

// ============================================
// SKELETON TABLE
// ============================================

interface SkeletonTableProps {
    /** Number of rows */
    rows?: number;
    /** Number of columns */
    columns?: number;
    /** Show header row */
    withHeader?: boolean;
    className?: string;
}

/**
 * Skeleton table - table placeholder with configurable rows and columns
 */
export function SkeletonTable({
    rows = 5,
    columns = 4,
    withHeader = true,
    className,
}: SkeletonTableProps) {
    return (
        <div
            className={cn(
                "animate-pulse rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900",
                className
            )}
        >
            {withHeader && (
                <div className="flex gap-4 border-b border-gray-200 p-4 dark:border-gray-800">
                    {Array.from({ length: columns }).map((_, i) => (
                        <Skeleton key={i} className="h-4 flex-1" />
                    ))}
                </div>
            )}
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
                {Array.from({ length: rows }).map((_, rowIdx) => (
                    <div key={rowIdx} className="flex gap-4 p-4">
                        {Array.from({ length: columns }).map((_, colIdx) => (
                            <Skeleton key={colIdx} className="h-4 flex-1" />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ============================================
// SKELETON LIST
// ============================================

interface SkeletonListProps {
    /** Number of items */
    items?: number;
    /** Show avatar for each item */
    withAvatar?: boolean;
    className?: string;
}

/**
 * Skeleton list - vertical list of item placeholders
 */
export function SkeletonList({
    items = 3,
    withAvatar = true,
    className,
}: SkeletonListProps) {
    return (
        <div className={cn("space-y-4", className)}>
            {Array.from({ length: items }).map((_, i) => (
                <div
                    key={i}
                    className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
                >
                    {withAvatar && <SkeletonAvatar size="md" />}
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-3 w-1/3" />
                    </div>
                </div>
            ))}
        </div>
    );
}

// ============================================
// SKELETON HEADER
// ============================================

interface SkeletonHeaderProps {
    /** Show action button */
    withAction?: boolean;
    className?: string;
}

/**
 * Skeleton header - page header placeholder with optional action button
 */
export function SkeletonHeader({ withAction = true, className }: SkeletonHeaderProps) {
    return (
        <div className={cn("flex items-center justify-between", className)}>
            <Skeleton className="h-8 w-32" />
            {withAction && <Skeleton className="h-10 w-32" />}
        </div>
    );
}

// ============================================
// LOADING CENTER
// ============================================

import { Spinner } from "@/components/ui/spinner";

interface LoadingCenterProps {
    /** Label to show below spinner */
    label?: string;
    /** Spinner size */
    size?: "sm" | "md" | "lg" | "xl";
    /** Full height (min-h-[50vh]) */
    fullHeight?: boolean;
    className?: string;
}

/**
 * Loading center - centered spinner with optional label
 */
export function LoadingCenter({
    label = "Loading...",
    size = "lg",
    fullHeight = false,
    className,
}: LoadingCenterProps) {
    return (
        <div
            className={cn(
                "flex items-center justify-center",
                fullHeight && "min-h-[50vh]",
                !fullHeight && "py-8",
                className
            )}
        >
            <div className="flex flex-col items-center gap-3">
                <Spinner size={size} />
                {label && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
                )}
            </div>
        </div>
    );
}
