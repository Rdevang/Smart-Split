"use client";

import { useState, useRef, useEffect, useCallback, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Link } from "@/components/ui/link";
import {
    Wallet,
    LayoutDashboard,
    Users,
    Receipt,
    PieChart,
    Settings,
    LogOut,
    User,
    ChevronDown,
    Menu,
    X,
    UserPlus,
    Shield,
    Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/app/(auth)/actions";
import Image from "next/image";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { NotificationBell } from "@/components/layout/notification-bell";

// Skeleton for streaming - shows while navbar loads
export function NavbarSkeleton() {
    return (
        <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/80 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-950/80">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-600">
                        <Wallet className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-xl font-bold text-gray-900 dark:text-white">
                        Smart<span className="text-teal-600">Split</span>
                    </span>
                </div>
                <div className="hidden md:flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-8 w-20 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                    ))}
                </div>
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-gray-100 dark:bg-gray-800 rounded-full animate-pulse" />
                    <div className="h-8 w-8 bg-gray-100 dark:bg-gray-800 rounded-full animate-pulse" />
                </div>
            </div>
        </header>
    );
}

interface NavbarProps {
    user: {
        id: string;
        email: string;
        full_name?: string | null;
        avatar_url?: string | null;
        role?: string;
    };
}

const navLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/groups", label: "Groups", icon: Users },
    { href: "/friends", label: "Friends", icon: UserPlus },
    { href: "/expenses", label: "Expenses", icon: Receipt },
    { href: "/activity", label: "Activity", icon: PieChart },
];

export function Navbar({ user }: NavbarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const [, startTransition] = useTransition();
    const profileRef = useRef<HTMLDivElement>(null);
    const mobileMenuRef = useRef<HTMLDivElement>(null);

    // Optimistic sign out - redirect immediately, signOut in background
    const handleSignOut = useCallback(() => {
        setIsSigningOut(true);
        setIsProfileOpen(false);

        // Redirect immediately for instant feel
        router.push("/login");

        // Sign out in background
        startTransition(() => {
            signOut();
        });
    }, [router]);

    // Close mobile menu
    const closeMobileMenu = useCallback(() => {
        setIsMobileMenuOpen(false);
    }, []);

    // Close dropdowns when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
                setIsProfileOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Prevent body scroll when mobile menu is open
    useEffect(() => {
        if (isMobileMenuOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isMobileMenuOpen]);

    const initials = user.full_name
        ? user.full_name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2)
        : user.email[0].toUpperCase();

    return (
        <>
            <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/80 backdrop-blur-lg dark:border-gray-800 dark:bg-gray-950/80">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                    {/* Left side - Hamburger + Logo */}
                    <div className="flex items-center gap-3">
                        {/* Mobile menu button */}
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 md:hidden dark:text-gray-400 dark:hover:bg-gray-800"
                        >
                            {isMobileMenuOpen ? (
                                <X className="h-5 w-5" />
                            ) : (
                                <Menu className="h-5 w-5" />
                            )}
                        </button>

                        {/* Logo */}
                        <Link href="/dashboard" className="flex items-center gap-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 shadow-lg shadow-teal-500/25">
                                <Wallet className="h-5 w-5 text-white" />
                            </div>
                            <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
                                Smart<span className="text-teal-600">Split</span>
                            </span>
                        </Link>
                    </div>

                    {/* Desktop Navigation */}
                    <nav className="hidden items-center gap-1 md:flex">
                        {navLinks.map((link) => {
                            const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={cn(
                                        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                                        isActive
                                            ? "bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"
                                            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
                                    )}
                                >
                                    <link.icon className="h-4 w-4" />
                                    {link.label}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Right side */}
                    <div className="flex items-center gap-3">
                        {/* Theme Toggle */}
                        <ThemeToggle />

                        {/* Notifications */}
                        <NotificationBell userId={user.id} />

                        {/* Profile Dropdown */}
                        <div className="relative" ref={profileRef}>
                            <button
                                onClick={() => setIsProfileOpen(!isProfileOpen)}
                                className="flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                            >
                                {user.avatar_url ? (
                                    <Image
                                        src={user.avatar_url}
                                        alt={user.full_name || "Profile"}
                                        width={32}
                                        height={32}
                                        className="h-8 w-8 rounded-full object-cover"
                                        unoptimized
                                    />
                                ) : (
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-600 text-xs font-semibold text-white">
                                        {initials}
                                    </div>
                                )}
                                <ChevronDown
                                    className={cn(
                                        "hidden h-4 w-4 text-gray-500 transition-transform sm:block",
                                        isProfileOpen && "rotate-180"
                                    )}
                                />
                            </button>

                            {/* Dropdown Menu */}
                            {isProfileOpen && (
                                <div className="absolute right-0 mt-2 w-64 origin-top-right rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-800 dark:bg-gray-900">
                                    {/* User info */}
                                    <div className="border-b border-gray-100 px-3 py-3 dark:border-gray-800">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                                            {user.full_name || "User"}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {user.email}
                                        </p>
                                    </div>

                                    {/* Menu items */}
                                    <div className="py-2">
                                        <Link
                                            href="/settings/profile"
                                            onClick={() => setIsProfileOpen(false)}
                                            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                                        >
                                            <User className="h-4 w-4" />
                                            Profile Settings
                                        </Link>
                                        <Link
                                            href="/settings"
                                            onClick={() => setIsProfileOpen(false)}
                                            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                                        >
                                            <Settings className="h-4 w-4" />
                                            Settings
                                        </Link>
                                    </div>

                                    {/* Admin Link - Only for site_admin or admin */}
                                    {(user.role === "site_admin" || user.role === "admin") && (
                                        <div className="border-t border-gray-100 py-2 dark:border-gray-800">
                                            <Link
                                                href="/admin"
                                                onClick={() => setIsProfileOpen(false)}
                                                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                                            >
                                                <Shield className="h-4 w-4" />
                                                Admin Panel
                                            </Link>
                                        </div>
                                    )}

                                    {/* Logout */}
                                    <div className="border-t border-gray-100 pt-2 dark:border-gray-800">
                                        <button
                                            onClick={handleSignOut}
                                            disabled={isSigningOut}
                                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/20"
                                        >
                                            {isSigningOut ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <LogOut className="h-4 w-4" />
                                            )}
                                            {isSigningOut ? "Signing out..." : "Sign out"}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>
                </div>

            </header>

            {/* Mobile Navigation Overlay */}
            {isMobileMenuOpen && (
                <>
                    {/* Backdrop - click to close */}
                    <div
                        className="fixed inset-0 z-[60] bg-black/50 md:hidden"
                        onClick={closeMobileMenu}
                        aria-hidden="true"
                    />

                    {/* Slide-in Menu from Left */}
                    <div
                        ref={mobileMenuRef}
                        className="fixed top-16 left-0 z-[70] h-[calc(100vh-4rem)] w-72 border-r border-gray-200 bg-white p-4 shadow-2xl md:hidden dark:border-gray-800 dark:bg-gray-950"
                    >
                        <nav className="flex flex-col gap-1">
                            {navLinks.map((link) => {
                                const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
                                return (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        onClick={closeMobileMenu}
                                        className={cn(
                                            "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                                            isActive
                                                ? "bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"
                                                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
                                        )}
                                    >
                                        <link.icon className="h-5 w-5" />
                                        {link.label}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>
                </>
            )}
        </>
    );
}

