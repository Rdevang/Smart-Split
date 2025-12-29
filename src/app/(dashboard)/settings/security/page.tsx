"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Shield, Key, Smartphone, LogOut, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui";
import { Link } from "@/components/ui/link";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";

export default function SecurityPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [showPasswords, setShowPasswords] = useState({
        current: false,
        new: false,
        confirm: false,
    });
    const [passwords, setPasswords] = useState({
        current: "",
        new: "",
        confirm: "",
    });
    const [changingPassword, setChangingPassword] = useState(false);
    const [signingOut, setSigningOut] = useState(false);

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!passwords.current) {
            toast({
                title: "Error",
                message: "Please enter your current password",
                variant: "error",
            });
            return;
        }

        if (passwords.new !== passwords.confirm) {
            toast({
                title: "Error",
                message: "New passwords do not match",
                variant: "error",
            });
            return;
        }

        if (passwords.new.length < 8) {
            toast({
                title: "Error",
                message: "Password must be at least 8 characters",
                variant: "error",
            });
            return;
        }

        setChangingPassword(true);
        try {
            const supabase = createClient();
            
            // First, get the user's email
            const { data: { user } } = await supabase.auth.getUser();
            if (!user?.email) {
                throw new Error("Unable to verify user");
            }

            // Re-authenticate with current password to verify identity
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: passwords.current,
            });

            if (signInError) {
                throw new Error("Current password is incorrect");
            }

            // Now update to new password
            const { error } = await supabase.auth.updateUser({
                password: passwords.new,
            });

            if (error) {
                throw error;
            }

            toast({
                title: "Password updated",
                message: "Your password has been changed successfully.",
                variant: "success",
            });
            setPasswords({ current: "", new: "", confirm: "" });
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Failed to update password";
            toast({
                title: "Error",
                message: errorMessage,
                variant: "error",
            });
        } finally {
            setChangingPassword(false);
        }
    };

    const handleSignOutAllDevices = async () => {
        setSigningOut(true);
        try {
            const supabase = createClient();
            
            // Sign out from all sessions
            const { error } = await supabase.auth.signOut({ scope: "global" });
            
            if (error) {
                throw error;
            }

            toast({
                title: "Signed out",
                message: "You have been signed out from all devices.",
                variant: "success",
            });
            
            router.push("/login");
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Failed to sign out";
            toast({
                title: "Error",
                message: errorMessage,
                variant: "error",
            });
            setSigningOut(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link
                    href="/settings"
                    className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Security
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Manage your password and account security
                    </p>
                </div>
            </div>

            {/* Change Password */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-teal-100 p-2 dark:bg-teal-900/30">
                            <Key className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                        </div>
                        <div>
                            <CardTitle>Change Password</CardTitle>
                            <CardDescription>
                                Update your password to keep your account secure
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handlePasswordChange} className="space-y-4">
                        <div className="relative">
                            <Input
                                type={showPasswords.current ? "text" : "password"}
                                placeholder="Current password"
                                value={passwords.current}
                                onChange={(e) =>
                                    setPasswords((p) => ({ ...p, current: e.target.value }))
                                }
                            />
                            <button
                                type="button"
                                onClick={() =>
                                    setShowPasswords((s) => ({ ...s, current: !s.current }))
                                }
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            >
                                {showPasswords.current ? (
                                    <EyeOff className="h-4 w-4" />
                                ) : (
                                    <Eye className="h-4 w-4" />
                                )}
                            </button>
                        </div>
                        <div className="relative">
                            <Input
                                type={showPasswords.new ? "text" : "password"}
                                placeholder="New password"
                                value={passwords.new}
                                onChange={(e) =>
                                    setPasswords((p) => ({ ...p, new: e.target.value }))
                                }
                            />
                            <button
                                type="button"
                                onClick={() =>
                                    setShowPasswords((s) => ({ ...s, new: !s.new }))
                                }
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            >
                                {showPasswords.new ? (
                                    <EyeOff className="h-4 w-4" />
                                ) : (
                                    <Eye className="h-4 w-4" />
                                )}
                            </button>
                        </div>
                        <div className="relative">
                            <Input
                                type={showPasswords.confirm ? "text" : "password"}
                                placeholder="Confirm new password"
                                value={passwords.confirm}
                                onChange={(e) =>
                                    setPasswords((p) => ({ ...p, confirm: e.target.value }))
                                }
                            />
                            <button
                                type="button"
                                onClick={() =>
                                    setShowPasswords((s) => ({ ...s, confirm: !s.confirm }))
                                }
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            >
                                {showPasswords.confirm ? (
                                    <EyeOff className="h-4 w-4" />
                                ) : (
                                    <Eye className="h-4 w-4" />
                                )}
                            </button>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Password must be at least 8 characters long
                        </p>
                        <Button
                            type="submit"
                            disabled={changingPassword || !passwords.current || !passwords.new || !passwords.confirm}
                        >
                            {changingPassword ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Updating...
                                </>
                            ) : (
                                "Update Password"
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* Two-Factor Authentication */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-gray-100 p-2 dark:bg-gray-800">
                            <Smartphone className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                        </div>
                        <div>
                            <CardTitle>Two-Factor Authentication</CardTitle>
                            <CardDescription>
                                Add an extra layer of security to your account
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                        <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                                Authenticator App
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Use an app like Google Authenticator or Authy
                            </p>
                        </div>
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                            Coming Soon
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* Active Sessions */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-red-100 p-2 dark:bg-red-900/30">
                            <LogOut className="h-5 w-5 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                            <CardTitle>Sessions</CardTitle>
                            <CardDescription>
                                Manage your active sessions across devices
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        If you suspect unauthorized access to your account, sign out from all devices.
                        You will need to sign in again on all your devices.
                    </p>
                    <Button
                        variant="danger"
                        onClick={handleSignOutAllDevices}
                        disabled={signingOut}
                    >
                        {signingOut ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Signing out...
                            </>
                        ) : (
                            <>
                                <LogOut className="mr-2 h-4 w-4" />
                                Sign Out All Devices
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}

