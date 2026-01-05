"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { clearRecaptchaSettingsCache } from "@/lib/recaptcha";

/**
 * Update an app setting's enabled status
 */
export async function updateAppSetting(
    settingId: string,
    isEnabled: boolean,
    userId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    // Verify user is site_admin
    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

    if (profileError || profile?.role !== "site_admin") {
        return { success: false, error: "Unauthorized: Only site admins can update settings" };
    }

    // Update the setting
    const { error } = await supabase
        .from("app_settings")
        .update({
            is_enabled: isEnabled,
            updated_by: userId,
        })
        .eq("id", settingId);

    if (error) {
        console.error("Error updating app setting:", error);
        return { success: false, error: error.message };
    }

    // Clear reCAPTCHA cache to pick up new settings immediately
    clearRecaptchaSettingsCache();

    revalidatePath("/admin/settings");
    return { success: true };
}

/**
 * Update reCAPTCHA configuration (score threshold, actions, etc.)
 */
export async function updateRecaptchaConfig(
    settingId: string,
    config: { score_threshold?: number; actions?: string[]; bypass_for_authenticated?: boolean },
    userId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    // Verify user is site_admin
    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

    if (profileError || profile?.role !== "site_admin") {
        return { success: false, error: "Unauthorized: Only site admins can update settings" };
    }

    // Get current value
    const { data: current, error: fetchError } = await supabase
        .from("app_settings")
        .select("value")
        .eq("id", settingId)
        .single();

    if (fetchError) {
        return { success: false, error: fetchError.message };
    }

    // Merge with new config
    const newValue = {
        ...((current?.value as Record<string, unknown>) || {}),
        ...config,
    };

    // Validate score threshold
    if (config.score_threshold !== undefined) {
        if (config.score_threshold < 0 || config.score_threshold > 1) {
            return { success: false, error: "Score threshold must be between 0 and 1" };
        }
    }

    // Update
    const { error } = await supabase
        .from("app_settings")
        .update({
            value: newValue,
            updated_by: userId,
        })
        .eq("id", settingId);

    if (error) {
        console.error("Error updating reCAPTCHA config:", error);
        return { success: false, error: error.message };
    }

    // Clear cache
    clearRecaptchaSettingsCache();

    revalidatePath("/admin/settings");
    return { success: true };
}

/**
 * Get all app settings
 */
export async function getAppSettings(): Promise<{
    success: boolean;
    data?: Array<{
        id: string;
        key: string;
        value: Record<string, unknown>;
        is_enabled: boolean;
        description: string | null;
        category: string;
        updated_at: string | null;
    }>;
    error?: string;
}> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .order("category", { ascending: true })
        .order("key", { ascending: true });

    if (error) {
        console.error("Error fetching app settings:", error);
        return { success: false, error: error.message };
    }

    return { success: true, data };
}

