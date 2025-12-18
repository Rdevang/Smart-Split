import { getCsrfToken } from "@/lib/csrf";
import { ForgotPasswordForm } from "./forgot-password-form";

export default async function ForgotPasswordPage() {
    // Generate CSRF token server-side
    const csrfToken = await getCsrfToken();

    return <ForgotPasswordForm csrfToken={csrfToken} />;
}
