"use client";

import { Suspense } from "react";
import { NavigationProgressProvider } from "@/components/layout/navigation-progress";

interface ProvidersProps {
    children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
    return (
        <Suspense fallback={null}>
            <NavigationProgressProvider>{children}</NavigationProgressProvider>
        </Suspense>
    );
}

