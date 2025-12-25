import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar, NavbarSkeleton } from "@/components/layout";
import { FeedbackButton } from "@/components/features/feedback/feedback-button";

// Streamed Navbar - fetches user data
async function NavbarWithUser() {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) {
        redirect("/login");
    }

    // Fetch profile for navbar
    const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, role")
        .eq("id", data.user.id)
        .single();

    const user = {
        id: data.user.id,
        email: data.user.email!,
        full_name: profile?.full_name || data.user.user_metadata?.full_name || null,
        avatar_url: profile?.avatar_url || data.user.user_metadata?.avatar_url || null,
        role: profile?.role || "user",
    };

    return <Navbar user={user} />;
}

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Only auth check blocks - profile is streamed
    const supabase = await createClient();
    const { error } = await supabase.auth.getUser();

    if (error) {
        redirect("/login");
    }

    return (
        <div className="min-h-screen overflow-x-hidden bg-gray-50 dark:bg-gray-950">
            {/* Navbar streams in - shows skeleton first */}
            <Suspense fallback={<NavbarSkeleton />}>
                <NavbarWithUser />
            </Suspense>
            <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                {children}
            </main>
            <FeedbackButton />
        </div>
    );
}
