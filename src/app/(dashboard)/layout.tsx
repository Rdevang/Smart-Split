import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout";
import { FeedbackButton } from "@/components/features/feedback/feedback-button";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) {
        redirect("/login");
    }

    // Fetch profile from database for latest avatar
    const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", data.user.id)
        .single();

    const user = {
        id: data.user.id,
        email: data.user.email!,
        full_name: profile?.full_name || data.user.user_metadata?.full_name || null,
        avatar_url: profile?.avatar_url || data.user.user_metadata?.avatar_url || null,
    };

    return (
        <div className="min-h-screen overflow-x-hidden bg-gray-50 dark:bg-gray-950">
            <Navbar user={user} />
            <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                {children}
            </main>
            <FeedbackButton />
        </div>
    );
}
