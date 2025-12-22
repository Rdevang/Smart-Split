import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
    title: "Terms of Service | SmartSplit",
    description: "Read the terms and conditions for using SmartSplit expense sharing application.",
};

export default function TermsPage() {
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
                    Terms of Service
                </h1>

                <div className="prose prose-gray dark:prose-invert max-w-none">
                    <p className="text-lg text-gray-600 dark:text-gray-400">
                        Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </p>

                    <h2 className="mt-8 text-2xl font-semibold text-gray-900 dark:text-white">
                        1. Acceptance of Terms
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                        By accessing or using SmartSplit, you agree to be bound by these Terms of Service. 
                        If you do not agree to these terms, please do not use our service.
                    </p>

                    <h2 className="mt-8 text-2xl font-semibold text-gray-900 dark:text-white">
                        2. Description of Service
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                        SmartSplit is an expense sharing application that allows users to:
                    </p>
                    <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400">
                        <li>Create groups with friends, family, or colleagues</li>
                        <li>Track shared expenses and split costs</li>
                        <li>Calculate and settle balances</li>
                        <li>View expense analytics and history</li>
                    </ul>

                    <h2 className="mt-8 text-2xl font-semibold text-gray-900 dark:text-white">
                        3. User Accounts
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                        You are responsible for:
                    </p>
                    <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400">
                        <li>Maintaining the confidentiality of your account credentials</li>
                        <li>All activities that occur under your account</li>
                        <li>Providing accurate and complete information</li>
                        <li>Notifying us immediately of any unauthorized use</li>
                    </ul>

                    <h2 className="mt-8 text-2xl font-semibold text-gray-900 dark:text-white">
                        4. Acceptable Use
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                        You agree not to:
                    </p>
                    <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400">
                        <li>Use the service for any illegal purpose</li>
                        <li>Attempt to gain unauthorized access to any systems</li>
                        <li>Transmit any malware or malicious code</li>
                        <li>Harass, abuse, or harm other users</li>
                        <li>Impersonate any person or entity</li>
                    </ul>

                    <h2 className="mt-8 text-2xl font-semibold text-gray-900 dark:text-white">
                        5. Payment & Settlements
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                        SmartSplit facilitates expense tracking and settlement calculations but:
                    </p>
                    <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400">
                        <li>Does not process actual monetary transactions</li>
                        <li>Is not responsible for payments between users</li>
                        <li>Settlements are made directly between users via their preferred payment methods</li>
                    </ul>

                    <h2 className="mt-8 text-2xl font-semibold text-gray-900 dark:text-white">
                        6. Limitation of Liability
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                        SmartSplit is provided &quot;as is&quot; without warranties of any kind. We are not liable for:
                    </p>
                    <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400">
                        <li>Any indirect, incidental, or consequential damages</li>
                        <li>Loss of data or service interruptions</li>
                        <li>Disputes between users regarding expenses or settlements</li>
                    </ul>

                    <h2 className="mt-8 text-2xl font-semibold text-gray-900 dark:text-white">
                        7. Termination
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                        We may terminate or suspend your account at any time for violations of these terms. 
                        You may delete your account at any time through your profile settings.
                    </p>

                    <h2 className="mt-8 text-2xl font-semibold text-gray-900 dark:text-white">
                        8. Changes to Terms
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                        We may update these terms from time to time. Continued use of the service after 
                        changes constitutes acceptance of the new terms.
                    </p>

                    <h2 className="mt-8 text-2xl font-semibold text-gray-900 dark:text-white">
                        9. Contact Us
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                        If you have any questions about these Terms, please contact us at{" "}
                        <a href="mailto:legal@smartsplit.app" className="text-teal-600 hover:text-teal-700 dark:text-teal-400">
                            legal@smartsplit.app
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}

