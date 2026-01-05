import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/settings/recaptcha
 * 
 * Returns whether reCAPTCHA is enabled.
 * This is a public endpoint so clients know whether to load the script.
 */
export async function GET() {
    try {
        const supabase = await createClient();

        const { data, error } = await supabase
            .from("app_settings")
            .select("is_enabled")
            .eq("key", "recaptcha")
            .single();

        if (error) {
            // If settings don't exist, reCAPTCHA is disabled
            return NextResponse.json({ enabled: false });
        }

        return NextResponse.json({
            enabled: data?.is_enabled ?? false,
            siteKey: data?.is_enabled ? process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY : null,
        });
    } catch {
        // On any error, return disabled (fail open)
        return NextResponse.json({ enabled: false });
    }
}

