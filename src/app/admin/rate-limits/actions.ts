"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateRateLimitSetting(
    settingId: string,
    isEnabled: boolean,
    userId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    // Verify user is site_admin (double-check on server)
    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

    if (profileError || profile?.role !== "site_admin") {
        return { success: false, error: "Unauthorized: Only site admins can update rate limit settings" };
    }

    // Update the setting
    const { error } = await supabase
        .from("rate_limit_settings")
        .update({
            is_enabled: isEnabled,
            updated_by: userId,
        })
        .eq("id", settingId);

    if (error) {
        console.error("Error updating rate limit setting:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/admin/rate-limits");
    return { success: true };
}

export async function getRateLimitSettings(): Promise<{
    success: boolean;
    data?: Array<{
        id: string;
        route_pattern: string;
        route_name: string;
        description: string | null;
        rate_limit_type: string;
        is_enabled: boolean;
        requests_limit: number;
        window_duration: string;
    }>;
    error?: string;
}> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("rate_limit_settings")
        .select("id, route_pattern, route_name, description, rate_limit_type, is_enabled, requests_limit, window_duration, updated_at")
        .order("route_name", { ascending: true });

    if (error) {
        console.error("Error fetching rate limit settings:", error);
        return { success: false, error: error.message };
    }

    return { success: true, data };
}

