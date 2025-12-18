import { getCsrfToken } from "@/lib/csrf";
import { RegisterForm } from "./register-form";

export default async function RegisterPage() {
    // Generate CSRF token server-side
    const csrfToken = await getCsrfToken();

    return <RegisterForm csrfToken={csrfToken} />;
}
