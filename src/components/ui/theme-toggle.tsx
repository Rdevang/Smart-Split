"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useSyncExternalStore } from "react";

// Use useSyncExternalStore to avoid hydration issues
function useIsMounted() {
    return useSyncExternalStore(
        () => () => { },
        () => true,
        () => false
    );
}

export function ThemeToggle() {
    const mounted = useIsMounted();
    const [isDark, setIsDark] = useState(() => {
        if (typeof window === "undefined") return false;
        const stored = localStorage.getItem("theme");
        if (stored === "dark") return true;
        if (stored === "light") return false;
        return window.matchMedia("(prefers-color-scheme: dark)").matches;
    });

    useEffect(() => {
        if (isDark) {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
    }, [isDark]);

    const toggleTheme = () => {
        const newIsDark = !isDark;
        setIsDark(newIsDark);
        localStorage.setItem("theme", newIsDark ? "dark" : "light");
    };

    if (!mounted) {
        return (
            <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Toggle theme">
                <Sun className="h-5 w-5" />
            </Button>
        );
    }

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-9 w-9"
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
            {isDark ? (
                <Moon className="h-5 w-5 text-yellow-400" />
            ) : (
                <Sun className="h-5 w-5 text-yellow-500" />
            )}
        </Button>
    );
}
