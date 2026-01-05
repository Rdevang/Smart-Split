/**
 * reCAPTCHA v3 Server Verification
 * 
 * This module provides server-side verification of reCAPTCHA tokens.
 * It checks if reCAPTCHA is enabled via admin settings before verification.
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// ============================================
// TYPES
// ============================================

export interface RecaptchaVerifyResult {
    success: boolean;
    score?: number;
    action?: string;
    error?: string;
    /** If reCAPTCHA is disabled, this will be true */
    skipped?: boolean;
}

export interface RecaptchaSettings {
    is_enabled: boolean;
    score_threshold: number;
    actions: string[];
    bypass_for_authenticated: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";
const DEFAULT_SCORE_THRESHOLD = 0.5;

// Cache for settings (TTL: 60 seconds)
let settingsCache: { settings: RecaptchaSettings | null; timestamp: number } | null = null;
const CACHE_TTL = 60 * 1000; // 60 seconds

// ============================================
// GET RECAPTCHA SETTINGS
// ============================================

/**
 * Fetches reCAPTCHA settings from the database
 * Uses in-memory cache to reduce DB calls
 */
export async function getRecaptchaSettings(): Promise<RecaptchaSettings> {
    // Check cache first
    if (settingsCache && Date.now() - settingsCache.timestamp < CACHE_TTL) {
        return settingsCache.settings || {
            is_enabled: false,
            score_threshold: DEFAULT_SCORE_THRESHOLD,
            actions: [],
            bypass_for_authenticated: false,
        };
    }

    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from("app_settings")
            .select("is_enabled, value")
            .eq("key", "recaptcha")
            .single();

        if (error || !data) {
            logger.warn("reCAPTCHA settings not found, using defaults", { error: error?.message });
            settingsCache = {
                settings: null,
                timestamp: Date.now(),
            };
            return {
                is_enabled: false,
                score_threshold: DEFAULT_SCORE_THRESHOLD,
                actions: [],
                bypass_for_authenticated: false,
            };
        }

        const settings: RecaptchaSettings = {
            is_enabled: data.is_enabled,
            score_threshold: data.value?.score_threshold ?? DEFAULT_SCORE_THRESHOLD,
            actions: data.value?.actions ?? [],
            bypass_for_authenticated: data.value?.bypass_for_authenticated ?? false,
        };

        // Update cache
        settingsCache = {
            settings,
            timestamp: Date.now(),
        };

        return settings;
    } catch (err) {
        logger.error("Failed to fetch reCAPTCHA settings", err instanceof Error ? err : new Error(String(err)));
        return {
            is_enabled: false,
            score_threshold: DEFAULT_SCORE_THRESHOLD,
            actions: [],
            bypass_for_authenticated: false,
        };
    }
}

/**
 * Clears the settings cache (useful after admin updates)
 */
export function clearRecaptchaSettingsCache(): void {
    settingsCache = null;
}

// ============================================
// VERIFY RECAPTCHA TOKEN
// ============================================

/**
 * Verifies a reCAPTCHA token with Google's API
 * 
 * @param token - The reCAPTCHA token from the client
 * @param expectedAction - The action name to verify (e.g., "login", "register")
 * @param isAuthenticated - Whether the user is already authenticated
 * @returns Verification result
 */
export async function verifyRecaptcha(
    token: string | null | undefined,
    expectedAction: string,
    isAuthenticated = false
): Promise<RecaptchaVerifyResult> {
    logger.info("[reCAPTCHA] Starting verification", { action: expectedAction, hasToken: !!token, isAuthenticated });

    // Get current settings
    const settings = await getRecaptchaSettings();
    logger.info("[reCAPTCHA] Settings loaded", {
        enabled: settings.is_enabled,
        threshold: settings.score_threshold,
        actions: settings.actions,
        bypassAuth: settings.bypass_for_authenticated,
    });

    // Check if reCAPTCHA is enabled
    if (!settings.is_enabled) {
        logger.info("[reCAPTCHA] ⏭️ SKIPPED - Disabled in settings");
        return { success: true, skipped: true };
    }

    // Check if we should bypass for authenticated users
    if (isAuthenticated && settings.bypass_for_authenticated) {
        logger.info("[reCAPTCHA] ⏭️ SKIPPED - Bypassed for authenticated user");
        return { success: true, skipped: true };
    }

    // Check if action is in the list of protected actions
    if (!settings.actions.includes(expectedAction)) {
        logger.info("[reCAPTCHA] ⏭️ SKIPPED - Action not in protected list", { expectedAction, protectedActions: settings.actions });
        return { success: true, skipped: true };
    }

    // Validate environment variables
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    if (!secretKey) {
        logger.error("[reCAPTCHA] ❌ RECAPTCHA_SECRET_KEY not configured");
        // Fail open in development, fail closed in production
        if (process.env.NODE_ENV === "development") {
            logger.warn("[reCAPTCHA] ⚠️ Verification skipped in development (missing secret key)");
            return { success: true, skipped: true };
        }
        return { success: false, error: "reCAPTCHA configuration error" };
    }

    // Validate token exists
    if (!token) {
        logger.warn("[reCAPTCHA] ❌ Token is missing");
        return { success: false, error: "reCAPTCHA token is required" };
    }

    logger.info("[reCAPTCHA] Token received, verifying with Google...", { tokenLength: token.length });

    try {
        // Verify with Google
        const startTime = Date.now();
        const response = await fetch(RECAPTCHA_VERIFY_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                secret: secretKey,
                response: token,
            }),
        });
        const duration = Date.now() - startTime;

        if (!response.ok) {
            logger.error("[reCAPTCHA] ❌ Google API request failed", new Error(`HTTP ${response.status}`));
            return { success: false, error: "reCAPTCHA verification failed" };
        }

        const result = await response.json();

        // Log full result for debugging
        logger.info("[reCAPTCHA] Google API response", {
            success: result.success,
            score: result.score,
            action: result.action,
            expectedAction,
            hostname: result.hostname,
            challengeTs: result.challenge_ts,
            errorCodes: result["error-codes"],
            duration: `${duration}ms`,
        });

        // Check success
        if (!result.success) {
            const errorCodes = result["error-codes"] || [];
            logger.warn("[reCAPTCHA] ❌ Verification FAILED", { errorCodes });
            return {
                success: false,
                error: "reCAPTCHA verification failed. Please try again.",
            };
        }

        // Verify action matches (prevents token reuse across different forms)
        if (result.action && result.action !== expectedAction) {
            logger.warn("[reCAPTCHA] ❌ Action MISMATCH", {
                expected: expectedAction,
                received: result.action,
            });
            return {
                success: false,
                error: "Security verification failed. Please try again.",
            };
        }

        // Check score threshold
        if (typeof result.score === "number" && result.score < settings.score_threshold) {
            logger.warn("[reCAPTCHA] ❌ Score BELOW threshold", {
                score: result.score,
                threshold: settings.score_threshold,
            });
            return {
                success: false,
                score: result.score,
                error: "Security check failed. Please try again or contact support.",
            };
        }

        logger.info("[reCAPTCHA] ✅ Verification PASSED", { score: result.score, action: result.action });

        return {
            success: true,
            score: result.score,
            action: result.action,
        };
    } catch (err) {
        logger.error("[reCAPTCHA] ❌ Verification error", err instanceof Error ? err : new Error(String(err)));
        return { success: false, error: "reCAPTCHA verification error" };
    }
}

// ============================================
// HELPER FOR FORM VALIDATION
// ============================================

/**
 * Validates reCAPTCHA from FormData
 * Convenience function for server actions
 */
export async function validateRecaptchaFromForm(
    formData: FormData,
    action: string,
    isAuthenticated = false
): Promise<RecaptchaVerifyResult> {
    const token = formData.get("recaptcha_token") as string | null;
    return verifyRecaptcha(token, action, isAuthenticated);
}

