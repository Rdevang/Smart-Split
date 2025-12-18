import { Suspense } from "react";
import { getCsrfToken } from "@/lib/csrf";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
    // Generate CSRF token server-side
    const csrfToken = await getCsrfToken();

    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
                </div>
            }
        >
            <LoginForm csrfToken={csrfToken} />
        </Suspense>
    );
}
