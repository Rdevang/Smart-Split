"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User, Mail, Phone, Globe, Camera } from "lucide-react";
import { Button, Input, Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";

const profileSchema = z.object({
    full_name: z.string().min(2, "Name must be at least 2 characters"),
    phone: z.string().optional(),
    currency: z.string(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface ProfileFormProps {
    user: {
        id: string;
        email: string;
        full_name: string | null;
        avatar_url: string | null;
        phone: string | null;
        currency: string;
    };
}

export function ProfileForm({ user }: ProfileFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<ProfileFormData>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            full_name: user.full_name || "",
            phone: user.phone || "",
            currency: user.currency || "USD",
        },
    });

    const onSubmit = async (data: ProfileFormData) => {
        setIsLoading(true);
        setMessage(null);

        try {
            const supabase = createClient();

            // Update profile in database
            const { error: profileError } = await supabase
                .from("profiles")
                .update({
                    full_name: data.full_name,
                    phone: data.phone || null,
                    currency: data.currency,
                })
                .eq("id", user.id);

            if (profileError) throw profileError;

            // Update auth metadata
            const { error: authError } = await supabase.auth.updateUser({
                data: { full_name: data.full_name },
            });

            if (authError) throw authError;

            setMessage({ type: "success", text: "Profile updated successfully!" });
        } catch (error) {
            setMessage({
                type: "error",
                text: error instanceof Error ? error.message : "Failed to update profile",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const currencies = [
        { value: "USD", label: "US Dollar ($)" },
        { value: "EUR", label: "Euro (€)" },
        { value: "GBP", label: "British Pound (£)" },
        { value: "INR", label: "Indian Rupee (₹)" },
        { value: "CAD", label: "Canadian Dollar (C$)" },
        { value: "AUD", label: "Australian Dollar (A$)" },
    ];

    const initials = user.full_name
        ? user.full_name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2)
        : user.email[0].toUpperCase();

    return (
        <div className="space-y-6">
            {/* Avatar section */}
            <Card>
                <CardHeader>
                    <CardTitle>Profile Picture</CardTitle>
                    <CardDescription>Update your profile picture</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-6">
                        {user.avatar_url ? (
                            <Image
                                src={user.avatar_url}
                                alt={user.full_name || "Profile"}
                                width={80}
                                height={80}
                                className="h-20 w-20 rounded-full object-cover"
                            />
                        ) : (
                            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-600 text-2xl font-semibold text-white">
                                {initials}
                            </div>
                        )}
                        <div>
                            <Button variant="outline" size="sm" disabled>
                                <Camera className="mr-2 h-4 w-4" />
                                Change Photo
                            </Button>
                            <p className="mt-2 text-xs text-gray-500">
                                JPG, GIF or PNG. Max size 2MB.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Profile form */}
            <Card>
                <CardHeader>
                    <CardTitle>Personal Information</CardTitle>
                    <CardDescription>Update your personal details</CardDescription>
                </CardHeader>
                <CardContent>
                    {message && (
                        <div
                            className={`mb-6 rounded-lg p-4 text-sm ${message.type === "success"
                                ? "border border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400"
                                : "border border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
                                }`}
                        >
                            {message.text}
                        </div>
                    )}

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid gap-6 sm:grid-cols-2">
                            <div className="relative">
                                <User className="absolute top-9 left-3 h-5 w-5 text-gray-400" />
                                <Input
                                    label="Full Name"
                                    placeholder="John Doe"
                                    className="pl-10"
                                    {...register("full_name")}
                                    error={errors.full_name?.message}
                                />
                            </div>

                            <div className="relative">
                                <Mail className="absolute top-9 left-3 h-5 w-5 text-gray-400" />
                                <Input
                                    label="Email"
                                    type="email"
                                    value={user.email}
                                    className="pl-10"
                                    disabled
                                    helperText="Email cannot be changed"
                                />
                            </div>

                            <div className="relative">
                                <Phone className="absolute top-9 left-3 h-5 w-5 text-gray-400" />
                                <Input
                                    label="Phone Number"
                                    placeholder="+1 (555) 000-0000"
                                    className="pl-10"
                                    {...register("phone")}
                                    error={errors.phone?.message}
                                />
                            </div>

                            <div className="relative">
                                <Globe className="absolute top-9 left-3 h-5 w-5 text-gray-400" />
                                <div className="space-y-1.5">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Currency
                                    </label>
                                    <select
                                        {...register("currency")}
                                        className="flex h-11 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 pl-10 text-sm text-gray-900 transition-colors focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                                    >
                                        {currencies.map((currency) => (
                                            <option key={currency.value} value={currency.value}>
                                                {currency.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <Button type="submit" isLoading={isLoading}>
                                Save Changes
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

