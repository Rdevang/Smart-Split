"use client";

/**
 * useRecaptcha Hook
 * 
 * Client-side hook for executing reCAPTCHA v3 challenges.
 * Automatically checks if reCAPTCHA is enabled before loading the script.
 */

import { useState, useEffect, useCallback, useRef } from "react";

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

// Module-level state to prevent multiple script loads
let scriptLoadPromise: Promise<void> | null = null;
let isScriptLoaded = false;

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
            try {
                const response = await fetch("/api/settings/recaptcha");
                if (!response.ok) {
                    throw new Error("Failed to fetch reCAPTCHA settings");
                }
                const data = await response.json();

                if (mountedRef.current) {
                    setIsEnabled(data.enabled);
                    if (!data.enabled) {
                        setIsLoading(false);
                        setIsReady(true); // Ready to skip
                    }
                }
            } catch (err) {
                if (mountedRef.current) {
                    // If we can't fetch settings, assume disabled (fail open)
                    setIsEnabled(false);
                    setIsLoading(false);
                    setIsReady(true);
                    console.warn("Could not fetch reCAPTCHA settings:", err);
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
            setError("reCAPTCHA site key not configured");
            setIsLoading(false);
            return;
        }

        // If already loaded, mark as ready
        if (isScriptLoaded && window.grecaptcha) {
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
            scriptLoadPromise = new Promise((resolve, reject) => {
                // Check if script already exists
                if (document.getElementById(SCRIPT_ID)) {
                    resolve();
                    return;
                }

                const script = document.createElement("script");
                script.id = SCRIPT_ID;
                script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
                script.async = true;
                script.defer = true;

                script.onload = () => {
                    isScriptLoaded = true;
                    resolve();
                };

                script.onerror = () => {
                    reject(new Error("Failed to load reCAPTCHA script"));
                };

                document.head.appendChild(script);
            });
        }

        scriptLoadPromise
            .then(() => {
                if (window.grecaptcha) {
                    window.grecaptcha.ready(() => {
                        if (mountedRef.current) {
                            setIsReady(true);
                            setIsLoading(false);
                        }
                    });
                }
            })
            .catch((err) => {
                if (mountedRef.current) {
                    setError(err.message);
                    setIsLoading(false);
                }
            });
    }, [isEnabled, siteKey]);

    // Execute reCAPTCHA
    const executeRecaptcha = useCallback(
        async (action: string): Promise<string | null> => {
            // If not enabled, return null (server will skip verification)
            if (!isEnabled) {
                return null;
            }

            if (!siteKey) {
                console.error("reCAPTCHA site key not configured");
                return null;
            }

            if (!isReady || !window.grecaptcha) {
                console.error("reCAPTCHA not ready");
                return null;
            }

            try {
                const token = await window.grecaptcha.execute(siteKey, { action });
                return token;
            } catch (err) {
                console.error("reCAPTCHA execution failed:", err);
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

