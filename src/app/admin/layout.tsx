import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminLayoutClient } from "./admin-layout-client";

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Check if user is site_admin
    const { data: profile } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", user.id)
        .single();

    if (profile?.role !== "site_admin" && profile?.role !== "admin") {
        redirect("/dashboard");
    }

    return (
        <AdminLayoutClient
            userName={profile?.full_name || user.email || "Admin"}
            userRole={profile?.role || "admin"}
        >
                    {children}
        </AdminLayoutClient>
    );
}

