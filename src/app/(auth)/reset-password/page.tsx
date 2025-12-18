import { getCsrfToken } from "@/lib/csrf";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage() {
    // Generate CSRF token server-side
    const csrfToken = await getCsrfToken();

    return <ResetPasswordForm csrfToken={csrfToken} />;
}
