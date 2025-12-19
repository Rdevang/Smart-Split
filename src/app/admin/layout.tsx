import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Shield, Users, MessageSquare, LayoutDashboard, ArrowLeft } from "lucide-react";
import { Link } from "@/components/ui/link";
import { cn } from "@/lib/utils";

const adminNavItems = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/feedback", label: "Feedback", icon: MessageSquare },
];

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
        <div className="min-h-screen bg-gray-100 dark:bg-gray-950">
            {/* Admin Header */}
            <header className="sticky top-0 z-50 border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                <div className="flex h-16 items-center justify-between px-4 sm:px-6">
                    <div className="flex items-center gap-4">
                        <Link 
                            href="/dashboard" 
                            className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            <span className="text-sm">Back to App</span>
                        </Link>
                        <div className="h-6 w-px bg-gray-200 dark:bg-gray-700" />
                        <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-red-600">
                                <Shield className="h-4 w-4 text-white" />
                            </div>
                            <span className="text-lg font-bold text-gray-900 dark:text-white">
                                Admin Panel
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <span>{profile?.full_name || user.email}</span>
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                            {profile?.role === "site_admin" ? "Site Admin" : "Admin"}
                        </span>
                    </div>
                </div>
            </header>

            <div className="flex">
                {/* Sidebar */}
                <aside className="sticky top-16 h-[calc(100vh-4rem)] w-64 border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                    <nav className="p-4 space-y-1">
                        {adminNavItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                                    "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                                    "dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
                                )}
                            >
                                <item.icon className="h-5 w-5" />
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                </aside>

                {/* Main Content */}
                <main className="flex-1 p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}

