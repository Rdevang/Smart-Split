"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Mail, CreditCard, Users, Receipt, Calendar, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface EmailPreferences {
    payment_reminders: boolean;
    settlement_requests: boolean;
    settlement_updates: boolean;
    group_invitations: boolean;
    expense_added: boolean;
    weekly_digest: boolean;
}

interface EmailPreferencesFormProps {
    userId: string;
    initialPreferences: EmailPreferences;
}

const PREFERENCE_CONFIG = [
    {
        key: "payment_reminders" as const,
        label: "Payment Reminders",
        description: "Get notified when someone reminds you to pay",
        icon: CreditCard,
    },
    {
        key: "settlement_requests" as const,
        label: "Settlement Requests",
        description: "Get notified when someone requests settlement approval",
        icon: Bell,
    },
    {
        key: "settlement_updates" as const,
        label: "Settlement Updates",
        description: "Get notified when settlements are approved or rejected",
        icon: CreditCard,
    },
    {
        key: "group_invitations" as const,
        label: "Group Invitations",
        description: "Get notified when someone invites you to a group",
        icon: Users,
    },
    {
        key: "expense_added" as const,
        label: "New Expenses",
        description: "Get notified when someone adds an expense in your groups",
        icon: Receipt,
    },
    {
        key: "weekly_digest" as const,
        label: "Weekly Digest",
        description: "Receive a weekly summary of your expenses and balances",
        icon: Calendar,
    },
];

export function EmailPreferencesForm({ userId, initialPreferences }: EmailPreferencesFormProps) {
    const [preferences, setPreferences] = useState<EmailPreferences>(initialPreferences);
    const [isPending, startTransition] = useTransition();
    const [hasChanges, setHasChanges] = useState(false);
    const { toast } = useToast();
    
    const handleToggle = (key: keyof EmailPreferences) => {
        setPreferences(prev => {
            const updated = { ...prev, [key]: !prev[key] };
            setHasChanges(true);
            return updated;
        });
    };
    
    const handleSave = () => {
        startTransition(async () => {
            try {
                const response = await fetch("/api/settings/email-preferences", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId, preferences }),
                });
                
                if (!response.ok) {
                    throw new Error("Failed to save preferences");
                }
                
                toast({
                    title: "Preferences saved",
                    message: "Your email preferences have been updated.",
                    variant: "success",
                });
                setHasChanges(false);
            } catch {
                toast({
                    title: "Error",
                    message: "Failed to save preferences. Please try again.",
                    variant: "error",
                });
            }
        });
    };
    
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Email Notifications
                </CardTitle>
                <CardDescription>
                    Choose which emails you&apos;d like to receive
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {PREFERENCE_CONFIG.map((config) => {
                    const Icon = config.icon;
                    const isEnabled = preferences[config.key];
                    
                    return (
                        <button
                            key={config.key}
                            onClick={() => handleToggle(config.key)}
                            className={`flex items-center justify-between w-full p-4 rounded-lg border transition-colors ${
                                isEnabled 
                                    ? "bg-teal-50 border-teal-200 dark:bg-teal-900/20 dark:border-teal-800" 
                                    : "bg-gray-50 border-gray-200 dark:bg-gray-800/50 dark:border-gray-700"
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${
                                    isEnabled 
                                        ? "bg-teal-100 text-teal-600 dark:bg-teal-800 dark:text-teal-400" 
                                        : "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                                }`}>
                                    <Icon className="h-4 w-4" />
                                </div>
                                <div className="text-left">
                                    <p className={`font-medium ${
                                        isEnabled 
                                            ? "text-gray-900 dark:text-white" 
                                            : "text-gray-500 dark:text-gray-400"
                                    }`}>
                                        {config.label}
                                    </p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {config.description}
                                    </p>
                                </div>
                            </div>
                            <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                isEnabled ? "bg-teal-500" : "bg-gray-300 dark:bg-gray-600"
                            }`}>
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                    isEnabled ? "translate-x-6" : "translate-x-1"
                                }`} />
                            </div>
                        </button>
                    );
                })}
                
                <div className="pt-4 flex justify-end">
                    <Button 
                        onClick={handleSave} 
                        disabled={!hasChanges || isPending}
                        className="bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600"
                    >
                        {isPending ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            "Save Preferences"
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

