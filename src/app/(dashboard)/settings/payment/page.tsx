"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CreditCard, Smartphone, Loader2, Check, Copy, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui";
import { Link } from "@/components/ui/link";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";

export default function PaymentPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [upiId, setUpiId] = useState("");
    const [savedUpiId, setSavedUpiId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        async function fetchPaymentMethods() {
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                
                if (user) {
                    setUserId(user.id);
                    // Fetch UPI ID through the API to handle decryption
                    const res = await fetch(`/api/upi/${user.id}`);
                    if (res.ok) {
                        const data = await res.json();
                        if (data.upi_id) {
                            setSavedUpiId(data.upi_id);
                            setUpiId(data.upi_id);
                        }
                    }
                }
            } catch (error) {
                console.error("Failed to fetch payment methods:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchPaymentMethods();
    }, []);

    const validateUpiId = (id: string): boolean => {
        // UPI ID format: username@bankname
        const upiRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/;
        return upiRegex.test(id);
    };

    const handleSaveUpi = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (upiId && !validateUpiId(upiId)) {
            toast({
                title: "Invalid UPI ID",
                message: "Please enter a valid UPI ID (e.g., username@paytm)",
                variant: "error",
            });
            return;
        }

        setSaving(true);
        try {
            const supabase = createClient();
            
            // Update UPI ID in profile
            const { error } = await supabase
                .from("profiles")
                .update({ upi_id: upiId || null })
                .eq("id", userId);

            if (error) {
                throw error;
            }

            setSavedUpiId(upiId || null);
            toast({
                title: upiId ? "UPI ID saved" : "UPI ID removed",
                message: upiId 
                    ? "Your UPI ID has been saved successfully."
                    : "Your UPI ID has been removed.",
                variant: "success",
            });
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Failed to save UPI ID";
            toast({
                title: "Error",
                message: errorMessage,
                variant: "error",
            });
        } finally {
            setSaving(false);
        }
    };

    const handleCopyUpi = async () => {
        if (savedUpiId) {
            await navigator.clipboard.writeText(savedUpiId);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            toast({
                title: "Copied!",
                message: "UPI ID copied to clipboard",
                variant: "success",
            });
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
                        Payment Methods
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Manage your payment methods for settlements
                    </p>
                </div>
            </div>

            {/* UPI ID */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-teal-100 p-2 dark:bg-teal-900/30">
                            <Smartphone className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                        </div>
                        <div>
                            <CardTitle>UPI ID</CardTitle>
                            <CardDescription>
                                Add your UPI ID so others can easily pay you
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSaveUpi} className="space-y-4">
                        {savedUpiId && (
                            <div className="flex items-center justify-between rounded-lg border border-teal-200 bg-teal-50 p-4 dark:border-teal-900 dark:bg-teal-900/20">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900/50">
                                        <QrCode className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            Current UPI ID
                                        </p>
                                        <p className="font-medium text-gray-900 dark:text-white">
                                            {savedUpiId}
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCopyUpi}
                                >
                                    {copied ? (
                                        <Check className="h-4 w-4 text-green-600" />
                                    ) : (
                                        <Copy className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                        )}

                        <div>
                            <Input
                                type="text"
                                placeholder="yourname@paytm"
                                value={upiId}
                                onChange={(e) => setUpiId(e.target.value)}
                            />
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                Enter your UPI ID (e.g., yourname@paytm, yourname@ybl, yourname@oksbi)
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <Button type="submit" disabled={saving}>
                                {saving ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : savedUpiId ? (
                                    "Update UPI ID"
                                ) : (
                                    "Save UPI ID"
                                )}
                            </Button>
                            {savedUpiId && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setUpiId("");
                                        handleSaveUpi(new Event("submit") as unknown as React.FormEvent);
                                    }}
                                    disabled={saving}
                                >
                                    Remove
                                </Button>
                            )}
                        </div>
                    </form>
                </CardContent>
            </Card>

            {/* Other Payment Methods */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-gray-100 p-2 dark:bg-gray-800">
                            <CreditCard className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                        </div>
                        <div>
                            <CardTitle>Other Payment Methods</CardTitle>
                            <CardDescription>
                                Additional ways to receive payments
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                        <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                                PayPal
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Link your PayPal account for international settlements
                            </p>
                        </div>
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                            Coming Soon
                        </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                        <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                                Bank Account
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Add bank details for direct transfers
                            </p>
                        </div>
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                            Coming Soon
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* Info Card */}
            <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-900/20">
                <CardContent className="py-4">
                    <div className="flex gap-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50">
                            <Smartphone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="font-medium text-blue-900 dark:text-blue-100">
                                How it works
                            </p>
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                                When someone settles up with you, they can see your UPI ID and pay you directly
                                through any UPI app. Your UPI ID is only visible to people in your shared groups.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

