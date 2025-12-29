"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell, Mail, MessageSquare, Users, Receipt, Calendar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui";
import { Link } from "@/components/ui/link";
import { useToast } from "@/components/ui/toast";

interface NotificationPreferences {
    payment_reminders: boolean;
    settlement_requests: boolean;
    settlement_updates: boolean;
    group_invitations: boolean;
    expense_added: boolean;
    weekly_digest: boolean;
}

const defaultPreferences: NotificationPreferences = {
    payment_reminders: true,
    settlement_requests: true,
    settlement_updates: true,
    group_invitations: true,
    expense_added: false,
    weekly_digest: true,
};

const notificationOptions = [
    {
        key: "payment_reminders" as const,
        icon: Bell,
        title: "Payment Reminders",
        description: "Get reminded about pending payments you owe",
    },
    {
        key: "settlement_requests" as const,
        icon: MessageSquare,
        title: "Settlement Requests",
        description: "When someone requests you to settle up",
    },
    {
        key: "settlement_updates" as const,
        icon: Receipt,
        title: "Settlement Updates",
        description: "When a settlement is recorded or confirmed",
    },
    {
        key: "group_invitations" as const,
        icon: Users,
        title: "Group Invitations",
        description: "When you're invited to join a group",
    },
    {
        key: "expense_added" as const,
        icon: Receipt,
        title: "New Expenses",
        description: "When an expense is added in your groups",
    },
    {
        key: "weekly_digest" as const,
        icon: Calendar,
        title: "Weekly Digest",
        description: "Summary of your balances and activity",
    },
];

export default function NotificationsPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        async function fetchPreferences() {
            try {
                const res = await fetch("/api/settings/email-preferences");
                if (res.ok) {
                    const data = await res.json();
                    setPreferences({ ...defaultPreferences, ...data.preferences });
                }
            } catch (error) {
                console.error("Failed to fetch preferences:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchPreferences();
    }, []);

    const handleToggle = (key: keyof NotificationPreferences) => {
        setPreferences((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/settings/email-preferences", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: "current", // API will use authenticated user
                    preferences,
                }),
            });

            if (res.ok) {
                toast({
                    title: "Preferences saved",
                    message: "Your notification preferences have been updated.",
                    variant: "success",
                });
            } else {
                throw new Error("Failed to save");
            }
        } catch (error) {
            toast({
                title: "Error",
                message: "Failed to save preferences. Please try again.",
                variant: "error",
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
            </div>
        );
    }

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
                        Notifications
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Manage your email and push notification preferences
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-teal-100 p-2 dark:bg-teal-900/30">
                            <Mail className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                        </div>
                        <div>
                            <CardTitle>Email Notifications</CardTitle>
                            <CardDescription>
                                Choose which emails you want to receive
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {notificationOptions.map((option) => (
                        <div
                            key={option.key}
                            className="flex items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-800"
                        >
                            <div className="flex items-center gap-3">
                                <option.icon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                                <div>
                                    <p className="font-medium text-gray-900 dark:text-white">
                                        {option.title}
                                    </p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {option.description}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={preferences[option.key]}
                                onClick={() => handleToggle(option.key)}
                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
                                    preferences[option.key]
                                        ? "bg-teal-600"
                                        : "bg-gray-200 dark:bg-gray-700"
                                }`}
                            >
                                <span
                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                        preferences[option.key] ? "translate-x-5" : "translate-x-0"
                                    }`}
                                />
                            </button>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => router.back()}>
                    Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                    {saving ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                        </>
                    ) : (
                        "Save Changes"
                    )}
                </Button>
            </div>
        </div>
    );
}

