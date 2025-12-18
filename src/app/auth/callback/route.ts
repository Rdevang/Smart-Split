import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ============================================
// SECURITY: OPEN REDIRECT PREVENTION
// ============================================
// Whitelist of allowed redirect paths to prevent open redirect attacks.
// Only internal paths starting with these prefixes are allowed.
const ALLOWED_REDIRECT_PATHS = [
    "/dashboard",
    "/groups",
    "/expenses",
    "/settings",
    "/activity",
    "/friends",
    "/reset-password",
];

/**
 * Validates that a redirect path is safe (internal only)
 * Prevents open redirect attacks like: ?next=https://evil.com
 */
function validateRedirectPath(path: string): string {
    // Must start with / and not be a protocol-relative URL (//)
    if (!path.startsWith("/") || path.startsWith("//")) {
        return "/dashboard";
    }
    
    // Must not contain protocol (://), prevents javascript: and data: URLs too
    if (path.includes("://") || path.includes("javascript:") || path.includes("data:")) {
        return "/dashboard";
    }
    
    // Must start with an allowed path prefix
    const isAllowed = ALLOWED_REDIRECT_PATHS.some(
        allowed => path === allowed || path.startsWith(`${allowed}/`) || path.startsWith(`${allowed}?`)
    );
    
    return isAllowed ? path : "/dashboard";
}

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const rawNext = searchParams.get("next") ?? "/dashboard";
    
    // SECURITY: Validate redirect path to prevent open redirect attacks
    const next = validateRedirectPath(rawNext);

    if (code) {
        const supabase = await createClient();
        
        // ============================================
        // SECURITY: SESSION FIXATION PREVENTION
        // ============================================
        // Supabase's exchangeCodeForSession automatically:
        // 1. Validates the OAuth state parameter (CSRF protection)
        // 2. Creates a NEW session (session regeneration)
        // 3. Sets secure, httpOnly cookies for the new session
        // 
        // This prevents session fixation attacks where an attacker
        // tricks a victim into using a session ID the attacker knows.
        
        // Clear any existing session before creating new one
        // This provides defense-in-depth against session fixation
        await supabase.auth.signOut({ scope: "local" });
        
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error && data.user) {
            const user = data.user;
            const email = user.email;
            const provider = user.app_metadata?.provider;

            // For OAuth providers (GitHub, Google), check if email already exists with different auth method
            if (provider && provider !== "email" && email) {
                // Check if a user with this email already exists in profiles
                // but was created with a different auth method
                const { data: existingProfile } = await supabase
                    .from("profiles")
                    .select("id")
                    .eq("email", email)
                    .neq("id", user.id)
                    .single();

                if (existingProfile) {
                    // Email already exists with a different account
                    // Sign out the newly created OAuth user
                    await supabase.auth.signOut();
                    
                    return NextResponse.redirect(
                        `${origin}/login?error=email_exists&error_description=An+account+with+this+email+already+exists.+Please+sign+in+with+your+original+method.`
                    );
                }
            }

            return NextResponse.redirect(`${origin}${next}`);
        }
    }

    // Return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}

