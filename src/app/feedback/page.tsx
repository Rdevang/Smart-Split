import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, MessageSquare, Bug, Lightbulb, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { FeedbackForm } from "@/components/features/feedback/feedback-form";

export const metadata: Metadata = {
    title: "Feedback | Smart Split",
    description: "Share your feedback, report bugs, or suggest new features for Smart Split",
};

export default async function FeedbackPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let profile = null;
    if (user) {
        const { data } = await supabase
            .from("profiles")
            .select("id, full_name")
            .eq("id", user.id)
            .single();
        profile = data;
    }

    const userInfo = user ? {
        id: user.id,
        email: user.email || "",
        full_name: profile?.full_name,
    } : null;

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
            <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
                {/* Back Link */}
                <Link
                    href={user ? "/dashboard" : "/"}
                    className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-8"
                >
                    <ArrowLeft className="h-4 w-4" />
                    {user ? "Back to Dashboard" : "Back to Home"}
                </Link>

                {/* Header */}
                <div className="text-center mb-12">
                    <div className="flex justify-center mb-4">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 text-white">
                            <MessageSquare className="h-8 w-8" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                        We&apos;d Love Your Feedback! 💬
                    </h1>
                    <p className="mt-3 text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
                        Your feedback helps us make Smart Split better for everyone.
                        Whether it&apos;s a bug, feature idea, or general suggestion - we want to hear from you!
                    </p>
                </div>

                {/* Quick Info Cards */}
                <div className="grid gap-4 sm:grid-cols-3 mb-10">
                    <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                        <Bug className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <h3 className="font-medium text-gray-900 dark:text-white">Report a Bug</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Found something broken? Let us know!
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                        <Sparkles className="h-5 w-5 text-purple-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <h3 className="font-medium text-gray-900 dark:text-white">Request a Feature</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Have an idea? We&apos;re all ears!
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                        <Lightbulb className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <h3 className="font-medium text-gray-900 dark:text-white">Share Suggestions</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Help us improve the experience!
                            </p>
                        </div>
                    </div>
                </div>

                {/* Feedback Form */}
                <FeedbackForm user={userInfo} />

                {/* Footer Note */}
                <p className="mt-8 text-center text-sm text-gray-400 dark:text-gray-500">
                    Your feedback is valuable to us. We review every submission and prioritize based on impact.
                    {!user && (
                        <>
                            {" "}
                            <Link href="/login" className="text-teal-600 hover:underline dark:text-teal-400">
                                Sign in
                            </Link>
                            {" "}for a faster experience.
                        </>
                    )}
                </p>
            </div>
        </div>
    );
}

