import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail, MessageSquare, Github, Twitter } from "lucide-react";

export const metadata: Metadata = {
    title: "Contact Us | SmartSplit",
    description: "Get in touch with the SmartSplit team for support, feedback, or inquiries.",
};

export default function ContactPage() {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
            <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
                <Link
                    href="/"
                    className="mb-8 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Home
                </Link>

                <h1 className="mb-4 text-4xl font-bold text-gray-900 dark:text-white">
                    Contact Us
                </h1>
                <p className="mb-12 text-lg text-gray-600 dark:text-gray-400">
                    We&apos;d love to hear from you. Choose the best way to reach us.
                </p>

                <div className="grid gap-6 sm:grid-cols-2">
                    {/* Email Support */}
                    <a
                        href="mailto:support@smartsplit.app"
                        className="group rounded-2xl border border-gray-200 bg-white p-6 transition-all hover:border-teal-300 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900 dark:hover:border-teal-700"
                    >
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-100 text-teal-600 transition-colors group-hover:bg-teal-500 group-hover:text-white dark:bg-teal-900/30 dark:text-teal-400">
                            <Mail className="h-6 w-6" />
                        </div>
                        <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
                            Email Support
                        </h2>
                        <p className="mb-3 text-gray-600 dark:text-gray-400">
                            For general inquiries and support
                        </p>
                        <span className="text-teal-600 dark:text-teal-400">
                            support@smartsplit.app
                        </span>
                    </a>

                    {/* Feedback */}
                    <Link
                        href="/feedback"
                        className="group rounded-2xl border border-gray-200 bg-white p-6 transition-all hover:border-purple-300 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900 dark:hover:border-purple-700"
                    >
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-purple-600 transition-colors group-hover:bg-purple-500 group-hover:text-white dark:bg-purple-900/30 dark:text-purple-400">
                            <MessageSquare className="h-6 w-6" />
                        </div>
                        <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
                            Send Feedback
                        </h2>
                        <p className="mb-3 text-gray-600 dark:text-gray-400">
                            Share ideas, report bugs, or request features
                        </p>
                        <span className="text-purple-600 dark:text-purple-400">
                            Open feedback form →
                        </span>
                    </Link>

                    {/* GitHub */}
                    <a
                        href="https://github.com/Rdevang/Smart-Split"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group rounded-2xl border border-gray-200 bg-white p-6 transition-all hover:border-gray-400 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-600"
                    >
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-600 transition-colors group-hover:bg-gray-800 group-hover:text-white dark:bg-gray-800 dark:text-gray-400">
                            <Github className="h-6 w-6" />
                        </div>
                        <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
                            GitHub
                        </h2>
                        <p className="mb-3 text-gray-600 dark:text-gray-400">
                            Report issues or contribute to the project
                        </p>
                        <span className="text-gray-600 dark:text-gray-400">
                            github.com/Rdevang/Smart-Split
                        </span>
                    </a>

                    {/* Twitter */}
                    <a
                        href="https://twitter.com/smartsplit"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group rounded-2xl border border-gray-200 bg-white p-6 transition-all hover:border-blue-300 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-700"
                    >
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-500 transition-colors group-hover:bg-blue-500 group-hover:text-white dark:bg-blue-900/30 dark:text-blue-400">
                            <Twitter className="h-6 w-6" />
                        </div>
                        <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
                            Twitter / X
                        </h2>
                        <p className="mb-3 text-gray-600 dark:text-gray-400">
                            Follow us for updates and announcements
                        </p>
                        <span className="text-blue-500 dark:text-blue-400">
                            @smartsplit
                        </span>
                    </a>
                </div>

                {/* FAQ Section */}
                <div className="mt-16">
                    <h2 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
                        Frequently Asked Questions
                    </h2>
                    
                    <div className="space-y-4">
                        <details className="group rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                            <summary className="flex cursor-pointer items-center justify-between font-medium text-gray-900 dark:text-white">
                                How do I create a group?
                                <span className="ml-2 transition-transform group-open:rotate-180">▼</span>
                            </summary>
                            <p className="mt-3 text-gray-600 dark:text-gray-400">
                                Navigate to the Groups page and click &quot;Create Group&quot;. Enter a name, 
                                optionally add a description and emoji, then invite members via email or 
                                share the QR code/invite link.
                            </p>
                        </details>

                        <details className="group rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                            <summary className="flex cursor-pointer items-center justify-between font-medium text-gray-900 dark:text-white">
                                How are expenses split?
                                <span className="ml-2 transition-transform group-open:rotate-180">▼</span>
                            </summary>
                            <p className="mt-3 text-gray-600 dark:text-gray-400">
                                Expenses can be split equally among selected members, by exact amounts, 
                                or by percentages. Choose your preferred split type when adding an expense.
                            </p>
                        </details>

                        <details className="group rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                            <summary className="flex cursor-pointer items-center justify-between font-medium text-gray-900 dark:text-white">
                                How do I settle up?
                                <span className="ml-2 transition-transform group-open:rotate-180">▼</span>
                            </summary>
                            <p className="mt-3 text-gray-600 dark:text-gray-400">
                                Go to your group page and check the &quot;Simplified Debts&quot; section. 
                                You can pay via UPI by scanning the QR code or clicking the Pay button. 
                                Once paid, click &quot;I&apos;ve Paid&quot; and the recipient will approve the settlement.
                            </p>
                        </details>

                        <details className="group rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                            <summary className="flex cursor-pointer items-center justify-between font-medium text-gray-900 dark:text-white">
                                Is my data secure?
                                <span className="ml-2 transition-transform group-open:rotate-180">▼</span>
                            </summary>
                            <p className="mt-3 text-gray-600 dark:text-gray-400">
                                Yes! We use encryption for sensitive data like UPI IDs and phone numbers. 
                                All connections are secured with HTTPS, and we implement row-level security 
                                to ensure you can only access your own data.
                            </p>
                        </details>
                    </div>
                </div>
            </div>
        </div>
    );
}

