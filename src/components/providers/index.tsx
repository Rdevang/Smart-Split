"use client";

import { Suspense } from "react";
import { NavigationProgressProvider } from "@/components/layout/navigation-progress";
import { ToastProvider } from "@/components/ui/toast";

interface ProvidersProps {
    children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
    return (
        <Suspense fallback={null}>
            <ToastProvider position="top-right">
                <NavigationProgressProvider>{children}</NavigationProgressProvider>
            </ToastProvider>
        </Suspense>
    );
}

