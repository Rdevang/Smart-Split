"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
    trackFailedLogin,
    clearFailedLogins,
    isAccountLocked
} from "@/lib/security-monitor";
import { logger, SecurityEvents } from "@/lib/logger";
import { validateCsrfToken } from "@/lib/csrf";
import { getGenericAuthError } from "@/lib/auth-errors";

/**
 * Gets the site URL, detecting localhost and Vercel preview environments automatically
 */
async function getSiteUrl(): Promise<string> {
    const headersList = await headers();
    const host = headersList.get("host") || "";

    // If running on localhost, use localhost URL
    if (host.includes("localhost") || host.includes("127.0.0.1")) {
        const protocol = host.includes("localhost") ? "http" : "https";
        return `${protocol}://${host}`;
    }

    // For Vercel deployments, use the actual host from the request
    // This correctly handles both production and preview URLs
    if (host) {
        return `https://${host}`;
    }

    // Fallback chain
    return process.env.NEXT_PUBLIC_SITE_URL
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
        || "http://localhost:3000";
}

/**
 * Validates CSRF token from form data
 * Returns error message if invalid, null if valid
 */
async function checkCsrf(formData: FormData): Promise<string | null> {
    const csrfToken = formData.get("csrf_token") as string | null;
    const validation = await validateCsrfToken(csrfToken);

    if (!validation.valid) {
        logger.security(
            SecurityEvents.CSRF_VIOLATION,
            "high",
            "blocked",
            { error: validation.error }
        );
        return validation.error || "Security validation failed. Please refresh the page.";
    }

    return null;
}

export async function login(formData: FormData) {
    // CSRF Protection
    const csrfError = await checkCsrf(formData);
    if (csrfError) {
        return { error: csrfError };
    }

    const supabase = await createClient();

    const data = {
        email: formData.get("email") as string,
        password: formData.get("password") as string,
    };

    // Check if account is locked before attempting login
    const lockStatus = await isAccountLocked(data.email);
    if (!lockStatus.allowed) {
        const remainingMinutes = lockStatus.lockoutEndsAt
            ? Math.ceil((lockStatus.lockoutEndsAt.getTime() - Date.now()) / 60000)
            : 30;
        return {
            error: `Account temporarily locked due to too many failed attempts. Please try again in ${remainingMinutes} minutes.`
        };
    }

    const { error } = await supabase.auth.signInWithPassword(data);

    if (error) {
        // Track failed login attempt
        const result = await trackFailedLogin(data.email);

        if (!result.allowed) {
            logger.security(
                SecurityEvents.LOGIN_FAILURE,
                "high",
                "blocked",
                { email: data.email, reason: "account_locked" }
            );
            return {
                error: "Account locked due to too many failed attempts. Please try again later."
            };
        }

        // Log the failed attempt with original error (for internal debugging)
        logger.security(
            SecurityEvents.LOGIN_FAILURE,
            "medium",
            "failure",
            { email: data.email, originalError: error.message }
        );

        // Return GENERIC error to prevent user enumeration
        // Don't reveal whether email exists or password is wrong
        const attemptsMsg = result.remainingAttempts
            ? ` (${result.remainingAttempts} attempts remaining)`
            : "";
        return {
            error: getGenericAuthError({
                originalError: error.message,
                type: "login",
                context: { email: data.email }
            }) + attemptsMsg
        };
    }

    // Clear failed login attempts on success
    await clearFailedLogins(data.email);

    logger.security(
        SecurityEvents.LOGIN_SUCCESS,
        "low",
        "success",
        { email: data.email }
    );

    revalidatePath("/", "layout");
    redirect("/dashboard");
}

export async function register(formData: FormData) {
    // CSRF Protection
    const csrfError = await checkCsrf(formData);
    if (csrfError) {
        return { error: csrfError };
    }

    const supabase = await createClient();

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const fullName = formData.get("full_name") as string;

    // Get the site URL for email confirmation redirect
    const siteUrl = await getSiteUrl();

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: fullName,
            },
            emailRedirectTo: `${siteUrl}/auth/callback?type=signup`,
        },
    });

    if (error) {
        // Log the actual error internally
        logger.security(
            SecurityEvents.ACCOUNT_CREATION_ATTEMPT,
            "low",
            "failure",
            { email, originalError: error.message }
        );

        // Return GENERIC error - don't reveal if email already exists
        return {
            error: getGenericAuthError({
                originalError: error.message,
                type: "register",
                context: { email }
            })
        };
    }

    // Check if email confirmation is required
    // If user is created but not confirmed, redirect to verify-email page
    if (data.user && !data.session) {
        // Email confirmation is required
        redirect(`/verify-email?email=${encodeURIComponent(email)}`);
    }

    // If session exists (email confirmation disabled), go to dashboard
    revalidatePath("/", "layout");
    redirect("/dashboard");
}

export async function signOut() {
    const supabase = await createClient();

    // Get user before signing out for logging
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.auth.signOut();

    if (user) {
        logger.security(
            SecurityEvents.LOGOUT,
            "low",
            "success",
            { userId: user.id }
        );
    }

    revalidatePath("/", "layout");
    redirect("/");
}

export async function signInWithGoogle() {
    const supabase = await createClient();
    const siteUrl = await getSiteUrl();

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
            redirectTo: `${siteUrl}/auth/callback`,
        },
    });

    if (error) {
        logger.security(
            SecurityEvents.OAUTH_ATTEMPT,
            "low",
            "failure",
            { provider: "google", originalError: error.message }
        );
        // Generic OAuth error
        return {
            error: getGenericAuthError({
                originalError: error.message,
                type: "oauth"
            })
        };
    }

    if (data.url) {
        redirect(data.url);
    }
}

export async function signInWithGithub() {
    const supabase = await createClient();
    const siteUrl = await getSiteUrl();

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
            redirectTo: `${siteUrl}/auth/callback`,
        },
    });

    if (error) {
        logger.security(
            SecurityEvents.OAUTH_ATTEMPT,
            "low",
            "failure",
            { provider: "github", originalError: error.message }
        );
        // Generic OAuth error
        return {
            error: getGenericAuthError({
                originalError: error.message,
                type: "oauth"
            })
        };
    }

    if (data.url) {
        redirect(data.url);
    }
}

export async function forgotPassword(formData: FormData) {
    // CSRF Protection
    const csrfError = await checkCsrf(formData);
    if (csrfError) {
        return { error: csrfError };
    }

    const supabase = await createClient();

    const email = formData.get("email") as string;
    const siteUrl = await getSiteUrl();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
    });

    // Log the request (always, even on error for security monitoring)
    logger.security(
        SecurityEvents.PASSWORD_RESET_REQUEST,
        "medium",
        error ? "failure" : "success",
        { email, hasError: !!error }
    );

    // ALWAYS return success message to prevent email enumeration
    // This is intentional security behavior
    return {
        success: true,
        message: "If an account exists with this email, you will receive a password reset link."
    };
}

export async function resetPassword(formData: FormData) {
    // CSRF Protection
    const csrfError = await checkCsrf(formData);
    if (csrfError) {
        return { error: csrfError };
    }

    const supabase = await createClient();

    const password = formData.get("password") as string;

    // Get current user for logging
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.auth.updateUser({
        password,
    });

    // Log the password change
    logger.security(
        SecurityEvents.PASSWORD_CHANGE,
        "high",
        error ? "failure" : "success",
        { userId: user?.id }
    );

    if (error) {
        // Generic error for password reset
        return {
            error: getGenericAuthError({
                originalError: error.message,
                type: "generic"
            })
        };
    }

    revalidatePath("/", "layout");
    redirect("/dashboard");
}

// Phone Authentication
export async function sendPhoneOTP(formData: FormData) {
    // CSRF Protection
    const csrfError = await checkCsrf(formData);
    if (csrfError) {
        return { error: csrfError };
    }

    const supabase = await createClient();

    const phone = formData.get("phone") as string;

    // Send OTP to phone number
    const { error } = await supabase.auth.signInWithOtp({
        phone,
    });

    if (error) {
        logger.warn("Phone OTP send failed", { phone, error: error.message });
        // Generic error - don't reveal if phone exists
        return {
            error: getGenericAuthError({
                originalError: error.message,
                type: "otp",
                context: { phone }
            })
        };
    }

    return { success: true };
}

export async function verifyPhoneOTP(formData: FormData) {
    // CSRF Protection
    const csrfError = await checkCsrf(formData);
    if (csrfError) {
        return { error: csrfError };
    }

    const supabase = await createClient();

    const phone = formData.get("phone") as string;
    const token = formData.get("token") as string;

    const { error } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: "sms",
    });

    if (error) {
        logger.warn("Phone OTP verification failed", { phone, error: error.message });
        // Generic error
        return {
            error: getGenericAuthError({
                originalError: error.message,
                type: "otp"
            })
        };
    }

    revalidatePath("/", "layout");
    redirect("/dashboard");
}

export async function signUpWithPhone(formData: FormData) {
    // CSRF Protection
    const csrfError = await checkCsrf(formData);
    if (csrfError) {
        return { error: csrfError };
    }

    const supabase = await createClient();

    const phone = formData.get("phone") as string;
    const fullName = formData.get("full_name") as string;

    // Sign up with phone - this sends an OTP
    const { error } = await supabase.auth.signUp({
        phone,
        password: crypto.randomUUID(), // Generate random password for phone-only auth
        options: {
            data: {
                full_name: fullName,
            },
        },
    });

    if (error) {
        logger.security(
            SecurityEvents.ACCOUNT_CREATION_ATTEMPT,
            "low",
            "failure",
            { phone, originalError: error.message }
        );
        // Generic error - don't reveal if phone already registered
        return {
            error: getGenericAuthError({
                originalError: error.message,
                type: "register",
                context: { phone }
            })
        };
    }

    return { success: true };
}
