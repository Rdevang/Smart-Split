import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
    // Check for required environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        console.error("Missing Supabase environment variables");
        // Allow request to continue without auth check if env vars missing
        return NextResponse.next({ request });
    }

    // Handle auth codes on root URL
    // Supabase sends users to /?code=xxx&type=xxx for various auth flows
    const code = request.nextUrl.searchParams.get("code");
    const type = request.nextUrl.searchParams.get("type");

    if (request.nextUrl.pathname === "/" && code) {
        const url = request.nextUrl.clone();
        url.pathname = "/auth/callback";
        url.searchParams.set("code", code);

        // Route based on auth type
        if (type === "recovery") {
            // Password recovery → go to reset password page
            url.searchParams.set("next", "/reset-password");
        } else if (type === "signup" || type === "email_change") {
            // Email verification → go to dashboard
            url.searchParams.set("next", "/dashboard");
        } else {
            // Default to dashboard for unknown types
            url.searchParams.set("next", "/dashboard");
        }

        return NextResponse.redirect(url);
    }

    let supabaseResponse = NextResponse.next({
        request,
    });

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value }) =>
                    request.cookies.set(name, value)
                );
                supabaseResponse = NextResponse.next({
                    request,
                });
                cookiesToSet.forEach(({ name, value, options }) =>
                    supabaseResponse.cookies.set(name, value, options)
                );
            },
        },
    });

    // Do not run code between createServerClient and
    // supabase.auth.getUser(). A simple mistake could make it very hard to debug
    // issues with users being randomly logged out.

    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Protected routes - redirect to login if not authenticated
    const protectedPaths = ["/dashboard", "/groups", "/expenses", "/activity", "/settings"];
    const isProtectedPath = protectedPaths.some((path) =>
        request.nextUrl.pathname.startsWith(path)
    );

    if (!user && isProtectedPath) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        return NextResponse.redirect(url);
    }

    // Redirect authenticated users away from auth pages
    if (
        user &&
        (request.nextUrl.pathname === "/login" ||
            request.nextUrl.pathname === "/register")
    ) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
    }

    return supabaseResponse;
}
