"use client";

/**
 * useRecaptcha Hook
 * 
 * Client-side hook for executing reCAPTCHA v3 challenges.
 * Automatically checks if reCAPTCHA is enabled before loading the script.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { log } from "@/lib/console-logger";

// ============================================
// TYPES
// ============================================

interface UseRecaptchaOptions {
    /** reCAPTCHA site key (from env) */
    siteKey?: string;
}

interface UseRecaptchaReturn {
    /** Execute reCAPTCHA and get token */
    executeRecaptcha: (action: string) => Promise<string | null>;
    /** Whether reCAPTCHA is ready to use */
    isReady: boolean;
    /** Whether reCAPTCHA is enabled (from settings) */
    isEnabled: boolean;
    /** Loading state */
    isLoading: boolean;
    /** Error message if any */
    error: string | null;
}

// Extend window type for grecaptcha
declare global {
    interface Window {
        grecaptcha: {
            ready: (callback: () => void) => void;
            execute: (siteKey: string, options: { action: string }) => Promise<string>;
        };
        __recaptchaCallback?: () => void;
    }
}

// ============================================
// CONSTANTS
// ============================================

const SCRIPT_ID = "recaptcha-v3-script";
const DEBUG = process.env.NODE_ENV === "development";

// Module-level state to prevent multiple script loads
let scriptLoadPromise: Promise<void> | null = null;
let isScriptLoaded = false;

// Debug logger
function debugLog(message: string, data?: unknown) {
    if (DEBUG) {
        log.debug("reCAPTCHA", message, data);
    }
}

// ============================================
// HOOK
// ============================================

export function useRecaptcha(options: UseRecaptchaOptions = {}): UseRecaptchaReturn {
    const { siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY } = options;

    const [isReady, setIsReady] = useState(false);
    const [isEnabled, setIsEnabled] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const mountedRef = useRef(true);

    // Check if reCAPTCHA is enabled from server
    useEffect(() => {
        mountedRef.current = true;

        async function checkEnabled() {
            debugLog("Checking if reCAPTCHA is enabled...");
            try {
                const response = await fetch("/api/settings/recaptcha");
                if (!response.ok) {
                    throw new Error("Failed to fetch reCAPTCHA settings");
                }
                const data = await response.json();
                debugLog("Settings response:", data);

                if (mountedRef.current) {
                    setIsEnabled(data.enabled);
                    if (!data.enabled) {
                        debugLog("reCAPTCHA is DISABLED in admin settings");
                        setIsLoading(false);
                        setIsReady(true); // Ready to skip
                    } else {
                        debugLog("reCAPTCHA is ENABLED, will load script");
                    }
                }
            } catch (err) {
                if (mountedRef.current) {
                    // If we can't fetch settings, assume disabled (fail open)
                    setIsEnabled(false);
                    setIsLoading(false);
                    setIsReady(true);
                    log.warn("reCAPTCHA", "Could not fetch settings", err);
                }
            }
        }

        checkEnabled();

        return () => {
            mountedRef.current = false;
        };
    }, []);

    // Load reCAPTCHA script if enabled
    useEffect(() => {
        if (!isEnabled) return;

        if (!siteKey) {
            debugLog("ERROR: Site key not configured");
            setError("reCAPTCHA site key not configured");
            setIsLoading(false);
            return;
        }

        debugLog("Site key found:", siteKey.substring(0, 10) + "...");

        // If already loaded, mark as ready
        if (isScriptLoaded && window.grecaptcha) {
            debugLog("Script already loaded, marking ready");
            window.grecaptcha.ready(() => {
                if (mountedRef.current) {
                    setIsReady(true);
                    setIsLoading(false);
                }
            });
            return;
        }

        // Load script if not already loading
        if (!scriptLoadPromise) {
            debugLog("Loading reCAPTCHA script...");
            scriptLoadPromise = new Promise((resolve, reject) => {
                // Check if script already exists
                if (document.getElementById(SCRIPT_ID)) {
                    debugLog("Script element already exists");
                    resolve();
                    return;
                }

                const script = document.createElement("script");
                script.id = SCRIPT_ID;
                script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
                script.async = true;
                script.defer = true;

                script.onload = () => {
                    debugLog("✅ Script loaded successfully");
                    isScriptLoaded = true;
                    resolve();
                };

                script.onerror = (e) => {
                    debugLog("❌ Script load failed", e);
                    reject(new Error("Failed to load reCAPTCHA script"));
                };

                document.head.appendChild(script);
            });
        }

        scriptLoadPromise
            .then(() => {
                if (window.grecaptcha) {
                    window.grecaptcha.ready(() => {
                        debugLog("✅ grecaptcha ready!");
                        if (mountedRef.current) {
                            setIsReady(true);
                            setIsLoading(false);
                        }
                    });
                }
            })
            .catch((err) => {
                debugLog("❌ Script load error:", err);
                if (mountedRef.current) {
                    setError(err.message);
                    setIsLoading(false);
                }
            });
    }, [isEnabled, siteKey]);

    // Execute reCAPTCHA
    const executeRecaptcha = useCallback(
        async (action: string): Promise<string | null> => {
            debugLog(`Executing reCAPTCHA for action: "${action}"`);
            debugLog(`State: isEnabled=${isEnabled}, isReady=${isReady}, hasSiteKey=${!!siteKey}`);

            // If not enabled, return null (server will skip verification)
            if (!isEnabled) {
                debugLog("⏭️ Skipping - reCAPTCHA disabled");
                return null;
            }

            if (!siteKey) {
                log.error("reCAPTCHA", "Site key not configured");
                return null;
            }

            if (!isReady || !window.grecaptcha) {
                log.error("reCAPTCHA", "Not ready yet", { isReady, hasGrecaptcha: !!window.grecaptcha });
                return null;
            }

            try {
                debugLog("Requesting token from Google...");
                const startTime = Date.now();
                const token = await window.grecaptcha.execute(siteKey, { action });
                const duration = Date.now() - startTime;
                debugLog(`✅ Token received in ${duration}ms:`, token.substring(0, 30) + "...");
                return token;
            } catch (err) {
                log.error("reCAPTCHA", "Execution failed", err);
                return null;
            }
        },
        [isEnabled, isReady, siteKey]
    );

    return {
        executeRecaptcha,
        isReady,
        isEnabled,
        isLoading,
        error,
    };
}

