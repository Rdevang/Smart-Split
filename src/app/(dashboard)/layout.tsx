import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout";
import { FeedbackButton } from "@/components/features/feedback/feedback-button";

// ============================================
// OPTIMIZED: Single auth call for entire layout
// ============================================

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();

    // SINGLE auth call - getUser() verifies with Supabase (security)
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) {
        redirect("/login");
    }

    const authUser = data.user;

    // Parallel profile fetch after auth (minimal delay since auth is verified)
    const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, role")
        .eq("id", authUser.id)
        .single();

    const user = {
        id: authUser.id,
        email: authUser.email!,
        full_name: profile?.full_name || authUser.user_metadata?.full_name || null,
        avatar_url: profile?.avatar_url || authUser.user_metadata?.avatar_url || null,
        role: profile?.role || "user",
    };

    return (
        <div className="min-h-screen overflow-x-hidden bg-gray-50 dark:bg-gray-950">
            {/* Navbar renders immediately with user data */}
            <Navbar user={user} />
            <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                {children}
            </main>
            <FeedbackButton />
        </div>
    );
}
