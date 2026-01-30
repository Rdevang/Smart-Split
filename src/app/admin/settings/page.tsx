import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppSettingsClient } from "./settings-client";

export const metadata = {
    title: "App Settings | Admin | Smart Split",
    description: "Manage application-wide settings and feature flags",
};

interface AppSetting {
    id: string;
    key: string;
    value: Record<string, unknown>;
    is_enabled: boolean;
    description: string | null;
    category: string;
    updated_at: string | null;
}

export default async function AdminSettingsPage() {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        redirect("/login");
    }

    // Check if user is site_admin
    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (profile?.role !== "site_admin") {
        redirect("/dashboard");
    }

    // Fetch all app settings
    const { data: settings, error } = await supabase
        .from("app_settings")
        .select("id, key, value, is_enabled, description, category, updated_at")
        .order("category", { ascending: true })
        .order("key", { ascending: true });

    if (error) {
        console.error("Error fetching app settings:", error);
    }

    // Check if reCAPTCHA environment variables are configured
    const recaptchaConfigured = !!(
        process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY &&
        process.env.RECAPTCHA_SECRET_KEY
    );

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    App Settings
                </h1>
                <p className="mt-1 text-gray-500 dark:text-gray-400">
                    Manage application-wide settings and feature flags
                </p>
            </div>

            {/* Settings Component */}
            <AppSettingsClient
                initialSettings={(settings as AppSetting[]) || []}
                userId={user.id}
                recaptchaConfigured={recaptchaConfigured}
            />
        </div>
    );
}

