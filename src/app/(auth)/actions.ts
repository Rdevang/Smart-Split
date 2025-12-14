"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
    const supabase = await createClient();

    const data = {
        email: formData.get("email") as string,
        password: formData.get("password") as string,
    };

    const { error } = await supabase.auth.signInWithPassword(data);

    if (error) {
        return { error: error.message };
    }

    revalidatePath("/", "layout");
    redirect("/dashboard");
}

export async function register(formData: FormData) {
    const supabase = await createClient();

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const fullName = formData.get("full_name") as string;

    // Get the site URL for email confirmation redirect
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
        || "http://localhost:3000";

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
        return { error: error.message };
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
    await supabase.auth.signOut();
    revalidatePath("/", "layout");
    redirect("/");
}

export async function signInWithGoogle() {
    const supabase = await createClient();

    // Get the site URL - prioritize explicit config, then Vercel auto-detected URL
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
        || "http://localhost:3000";

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
            redirectTo: `${siteUrl}/auth/callback`,
        },
    });

    if (error) {
        return { error: error.message };
    }

    if (data.url) {
        redirect(data.url);
    }
}

export async function signInWithGithub() {
    const supabase = await createClient();

    // Get the site URL - prioritize explicit config, then Vercel auto-detected URL
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
        || "http://localhost:3000";

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
            redirectTo: `${siteUrl}/auth/callback`,
        },
    });

    if (error) {
        return { error: error.message };
    }

    if (data.url) {
        redirect(data.url);
    }
}

export async function forgotPassword(formData: FormData) {
    const supabase = await createClient();

    const email = formData.get("email") as string;

    // Get the site URL for redirect
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
        || "http://localhost:3000";

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
    });

    if (error) {
        return { error: error.message };
    }

    return { success: true };
}

export async function resetPassword(formData: FormData) {
    const supabase = await createClient();

    const password = formData.get("password") as string;

    const { error } = await supabase.auth.updateUser({
        password,
    });

    if (error) {
        return { error: error.message };
    }

    revalidatePath("/", "layout");
    redirect("/dashboard");
}

// Phone Authentication
export async function sendPhoneOTP(formData: FormData) {
    const supabase = await createClient();

    const phone = formData.get("phone") as string;

    // Send OTP to phone number
    const { error } = await supabase.auth.signInWithOtp({
        phone,
    });

    if (error) {
        return { error: error.message };
    }

    return { success: true };
}

export async function verifyPhoneOTP(formData: FormData) {
    const supabase = await createClient();

    const phone = formData.get("phone") as string;
    const token = formData.get("token") as string;

    const { error } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: "sms",
    });

    if (error) {
        return { error: error.message };
    }

    revalidatePath("/", "layout");
    redirect("/dashboard");
}

export async function signUpWithPhone(formData: FormData) {
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
        return { error: error.message };
    }

    return { success: true };
}
