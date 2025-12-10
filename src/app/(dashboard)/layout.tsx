import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout";

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

    const user = {
        id: data.user.id,
        email: data.user.email!,
        full_name: data.user.user_metadata?.full_name || null,
        avatar_url: data.user.user_metadata?.avatar_url || null,
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
            <Navbar user={user} />
            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                {children}
            </main>
        </div>
    );
}

