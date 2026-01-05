"use client";

import { useState, useCallback } from "react";

/**
 * Hook to manage CSRF tokens with auto-refresh capability
 * 
 * Fetches a fresh token before form submission to prevent
 * expiration errors when users leave pages open for long periods.
 */
export function useCsrf(initialToken: string) {
    const [token, setToken] = useState(initialToken);

    /**
     * Gets a fresh CSRF token from the server
     * Call this before form submission to ensure token is valid
     */
    const refreshToken = useCallback(async (): Promise<string> => {
        try {
            const response = await fetch("/api/csrf");
            if (!response.ok) {
                // Fall back to existing token if refresh fails
                console.warn("Failed to refresh CSRF token, using existing");
                return token;
            }
            const data = await response.json();
            const newToken = data.token;
            setToken(newToken);
            return newToken;
        } catch (error) {
            console.warn("Error refreshing CSRF token:", error);
            return token;
        }
    }, [token]);

    return {
        token,
        refreshToken,
    };
}

