import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/dashboard";

    if (code) {
        const supabase = await createClient();
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

