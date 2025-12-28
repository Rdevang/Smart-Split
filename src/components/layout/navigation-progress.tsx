"use client";

import { useEffect, useState, useTransition, createContext, useContext, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

// Context for programmatically triggering navigation progress
interface NavigationProgressContextType {
    start: () => void;
    done: () => void;
    isNavigating: boolean;
}

// Export context for direct access (graceful fallback in Link component)
export const NavigationProgressContext = createContext<NavigationProgressContextType | null>(null);

export function useNavigationProgress() {
    const context = useContext(NavigationProgressContext);
    if (!context) {
        throw new Error("useNavigationProgress must be used within NavigationProgressProvider");
    }
    return context;
}

interface NavigationProgressProviderProps {
    children: React.ReactNode;
}

export function NavigationProgressProvider({ children }: NavigationProgressProviderProps) {
    const [isNavigating, setIsNavigating] = useState(false);
    const [progress, setProgress] = useState(0);
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Reset progress when route changes complete
    useEffect(() => {
        setIsNavigating(false);
        setProgress(0);
    }, [pathname, searchParams]);

    // Animate progress while navigating
    useEffect(() => {
        if (!isNavigating) return;

        // Start at 10% immediately
        setProgress(10);

        // Gradually increase progress
        const intervals = [
            setTimeout(() => setProgress(30), 100),
            setTimeout(() => setProgress(50), 300),
            setTimeout(() => setProgress(70), 600),
            setTimeout(() => setProgress(85), 1000),
            setTimeout(() => setProgress(95), 2000),
        ];

        return () => intervals.forEach(clearTimeout);
    }, [isNavigating]);

    const start = useCallback(() => {
        setIsNavigating(true);
        setProgress(0);
    }, []);

    const done = useCallback(() => {
        setProgress(100);
        setTimeout(() => {
            setIsNavigating(false);
            setProgress(0);
        }, 200);
    }, []);

    return (
        <NavigationProgressContext.Provider value={{ start, done, isNavigating }}>
            {/* Progress Bar */}
            <div
                className={cn(
                    "fixed left-0 top-0 z-[9999] h-0.5 bg-teal-500 transition-all duration-300 ease-out",
                    isNavigating ? "opacity-100" : "opacity-0"
                )}
                style={{
                    width: `${progress}%`,
                    boxShadow: isNavigating ? "0 0 10px rgba(20, 184, 166, 0.7)" : "none",
                }}
            />
            {children}
        </NavigationProgressContext.Provider>
    );
}

// Hook to detect navigation in progress using React's useTransition
export function useNavigationState() {
    const [isPending, startTransition] = useTransition();
    return { isPending, startTransition };
}

