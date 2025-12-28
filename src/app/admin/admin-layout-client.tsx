"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Shield, Users, MessageSquare, LayoutDashboard, ArrowLeft, Gauge, Menu, X } from "lucide-react";
import { Link } from "@/components/ui/link";
import { cn } from "@/lib/utils";

const adminNavItems = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/feedback", label: "Feedback", icon: MessageSquare },
    { href: "/admin/rate-limits", label: "Rate Limits", icon: Gauge },
];

interface AdminLayoutClientProps {
    children: React.ReactNode;
    userName: string;
    userRole: string;
}

export function AdminLayoutClient({ children, userName, userRole }: AdminLayoutClientProps) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const pathname = usePathname();

    // Close sidebar when route changes (mobile)
    useEffect(() => {
        setIsSidebarOpen(false);
    }, [pathname]);

    // Prevent body scroll when sidebar is open on mobile
    useEffect(() => {
        if (isSidebarOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isSidebarOpen]);

    const closeSidebar = useCallback(() => {
        setIsSidebarOpen(false);
    }, []);

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-950">
            {/* Admin Header */}
            <header className="sticky top-0 z-50 border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                <div className="flex h-14 sm:h-16 items-center justify-between px-3 sm:px-6">
                    <div className="flex items-center gap-2 sm:gap-4">
                        {/* Mobile menu button */}
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 md:hidden dark:text-gray-400 dark:hover:bg-gray-800"
                        >
                            {isSidebarOpen ? (
                                <X className="h-5 w-5" />
                            ) : (
                                <Menu className="h-5 w-5" />
                            )}
                        </button>

                        <Link
                            href="/dashboard"
                            className="flex items-center gap-1.5 sm:gap-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            <span className="text-xs sm:text-sm hidden xs:inline">Back to App</span>
                        </Link>
                        <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block" />
                        <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-red-600">
                                <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                            </div>
                            <span className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                                Admin
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        <span className="hidden sm:inline truncate max-w-[120px]">{userName}</span>
                        <span className="rounded-full bg-red-100 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                            {userRole === "site_admin" ? "Site Admin" : "Admin"}
                        </span>
                    </div>
                </div>
            </header>

            <div className="flex">
                {/* Mobile Sidebar Backdrop */}
                {isSidebarOpen && (
                    <div
                        className="fixed inset-0 z-40 bg-black/50 md:hidden"
                        onClick={closeSidebar}
                        aria-hidden="true"
                    />
                )}

                {/* Sidebar */}
                <aside
                    className={cn(
                        "fixed inset-y-0 left-0 z-50 w-64 transform border-r border-gray-200 bg-white pt-16 transition-transform duration-200 ease-in-out dark:border-gray-800 dark:bg-gray-900 md:sticky md:top-16 md:z-0 md:h-[calc(100vh-4rem)] md:transform-none md:pt-0",
                        isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
                    )}
                >
                    {/* Mobile logo in sidebar */}
                    <div className="flex items-center gap-2 px-4 py-4 md:hidden border-b border-gray-200 dark:border-gray-800">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-red-600">
                            <Shield className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-lg font-bold text-gray-900 dark:text-white">
                            Admin Panel
                        </span>
                    </div>

                    <nav className="p-4 space-y-1">
                        {adminNavItems.map((item) => {
                            const isActive = item.exact
                                ? pathname === item.href
                                : pathname.startsWith(item.href);

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                                        isActive
                                            ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                                            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
                                    )}
                                >
                                    <item.icon className="h-5 w-5" />
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>
                </aside>

                {/* Main Content */}
                <main className="flex-1 min-w-0 px-4 py-4 sm:px-6 sm:py-6">
                    {children}
                </main>
            </div>
        </div>
    );
}

