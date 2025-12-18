import { getCsrfToken } from "@/lib/csrf";
import { PhoneLoginForm } from "./phone-login-form";

export default async function PhoneLoginPage() {
    // Generate CSRF token server-side
    const csrfToken = await getCsrfToken();

    return <PhoneLoginForm csrfToken={csrfToken} />;
}
