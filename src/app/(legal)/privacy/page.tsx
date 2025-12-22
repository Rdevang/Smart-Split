import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
    title: "Privacy Policy | SmartSplit",
    description: "Learn how SmartSplit collects, uses, and protects your personal information.",
};

export default function PrivacyPage() {
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

                <h1 className="mb-8 text-4xl font-bold text-gray-900 dark:text-white">
                    Privacy Policy
                </h1>

                <div className="prose prose-gray dark:prose-invert max-w-none">
                    <p className="text-lg text-gray-600 dark:text-gray-400">
                        Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </p>

                    <h2 className="mt-8 text-2xl font-semibold text-gray-900 dark:text-white">
                        1. Information We Collect
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                        We collect information you provide directly to us, such as when you create an account, 
                        add expenses, create groups, or contact us for support.
                    </p>
                    <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400">
                        <li>Account information (name, email, profile picture)</li>
                        <li>Payment information (UPI ID for settlements)</li>
                        <li>Expense data (amounts, descriptions, categories)</li>
                        <li>Group information and member details</li>
                    </ul>

                    <h2 className="mt-8 text-2xl font-semibold text-gray-900 dark:text-white">
                        2. How We Use Your Information
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                        We use the information we collect to:
                    </p>
                    <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400">
                        <li>Provide, maintain, and improve our services</li>
                        <li>Process transactions and send related notifications</li>
                        <li>Send you technical notices and support messages</li>
                        <li>Respond to your comments, questions, and requests</li>
                    </ul>

                    <h2 className="mt-8 text-2xl font-semibold text-gray-900 dark:text-white">
                        3. Data Security
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                        We implement appropriate security measures to protect your personal information:
                    </p>
                    <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400">
                        <li>Encryption of sensitive data (UPI IDs, phone numbers)</li>
                        <li>Secure HTTPS connections</li>
                        <li>Row-level security in our database</li>
                        <li>Regular security audits</li>
                    </ul>

                    <h2 className="mt-8 text-2xl font-semibold text-gray-900 dark:text-white">
                        4. Data Sharing
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                        We do not sell your personal information. We may share your information only:
                    </p>
                    <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400">
                        <li>With group members you choose to share expenses with</li>
                        <li>With service providers who assist in our operations</li>
                        <li>If required by law or to protect our rights</li>
                    </ul>

                    <h2 className="mt-8 text-2xl font-semibold text-gray-900 dark:text-white">
                        5. Your Rights
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                        You have the right to:
                    </p>
                    <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400">
                        <li>Access and download your data</li>
                        <li>Update or correct your information</li>
                        <li>Delete your account and associated data</li>
                        <li>Opt out of marketing communications</li>
                    </ul>

                    <h2 className="mt-8 text-2xl font-semibold text-gray-900 dark:text-white">
                        6. Contact Us
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                        If you have any questions about this Privacy Policy, please contact us at{" "}
                        <a href="mailto:privacy@smartsplit.app" className="text-teal-600 hover:text-teal-700 dark:text-teal-400">
                            privacy@smartsplit.app
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}

