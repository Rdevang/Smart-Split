import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { RateLimitSettingsClient } from "./rate-limits-client";

export const metadata = {
    title: "Rate Limit Settings | Admin",
    description: "Manage rate limiting for application routes",
};

export default async function RateLimitSettingsPage() {
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

    // Fetch rate limit settings
    const { data: settings, error } = await supabase
        .from("rate_limit_settings")
        .select("*")
        .order("route_name", { ascending: true });

    if (error) {
        console.error("Error fetching rate limit settings:", error);
    }

    return (
        <div className="space-y-6">
            {/* Back Link */}
            <Link
                href="/admin"
                className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to Admin
            </Link>

            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-red-500">
                    <Shield className="h-6 w-6 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Rate Limit Settings
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">
                        Enable or disable rate limiting on specific routes
                    </p>
                </div>
            </div>

            {/* Info Banner */}
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>⚠️ Caution:</strong> Disabling rate limits can expose your application to abuse.
                    Only disable temporarily for debugging or if you have alternative protection in place.
                </p>
            </div>

            {/* Settings Table */}
            <RateLimitSettingsClient initialSettings={settings || []} userId={user.id} />
        </div>
    );
}

