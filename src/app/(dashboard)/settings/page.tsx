import Link from "next/link";
import { User, Bell, Shield, CreditCard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui";

export default function SettingsPage() {
    const settingsLinks = [
        {
            href: "/settings/profile",
            icon: User,
            title: "Profile",
            description: "Update your personal information and preferences",
        },
        {
            href: "/settings/notifications",
            icon: Bell,
            title: "Notifications",
            description: "Manage email and push notification preferences",
        },
        {
            href: "/settings/security",
            icon: Shield,
            title: "Security",
            description: "Password, two-factor authentication, and sessions",
        },
        {
            href: "/settings/payment",
            icon: CreditCard,
            title: "Payment Methods",
            description: "Manage your payment methods for settlements",
        },
    ];

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Settings
                </h1>
                <p className="mt-1 text-gray-600 dark:text-gray-400">
                    Manage your account settings and preferences
                </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                {settingsLinks.map((link) => (
                    <Link key={link.href} href={link.href}>
                        <Card className="h-full transition-all hover:border-teal-500/50 hover:shadow-md">
                            <CardHeader>
                                <div className="flex items-center gap-4">
                                    <div className="rounded-lg bg-teal-100 p-2 dark:bg-teal-900/30">
                                        <link.icon className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-base">{link.title}</CardTitle>
                                        <CardDescription className="text-sm">
                                            {link.description}
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    );
}

