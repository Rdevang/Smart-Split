"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Image from "next/image";
import { User, Mail, Phone, Globe, Camera, Trash2, Loader2, Upload } from "lucide-react";
import {
    Button,
    Input,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
    CameraCapture,
} from "@/components/ui";
import { profileService } from "@/services/profile";

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
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [isDeletingAvatar, setIsDeletingAvatar] = useState(false);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatar_url);
    const [message, setMessage] = useState<{
        type: "success" | "error";
        text: string;
    } | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors, isDirty },
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
            const result = await profileService.updateProfile(user.id, {
                full_name: data.full_name,
                phone: data.phone || null,
                currency: data.currency,
            });

            if (!result.success) {
                throw new Error(result.error);
            }

            setMessage({ type: "success", text: "Profile updated successfully!" });
            router.refresh();
        } catch (error) {
            setMessage({
                type: "error",
                text: error instanceof Error ? error.message : "Failed to update profile",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingAvatar(true);
        setMessage(null);

        try {
            const result = await profileService.uploadAvatar(user.id, file);

            if (result.error) {
                throw new Error(result.error);
            }

            if (result.url) {
                setAvatarUrl(result.url);
                setMessage({ type: "success", text: "Profile picture updated!" });
                router.refresh();
            }
        } catch (error) {
            setMessage({
                type: "error",
                text: error instanceof Error ? error.message : "Failed to upload image",
            });
        } finally {
            setIsUploadingAvatar(false);
            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleDeleteAvatar = async () => {
        if (!avatarUrl) return;

        setIsDeletingAvatar(true);
        setMessage(null);

        try {
            const result = await profileService.deleteAvatar(user.id);

            if (!result.success) {
                throw new Error(result.error);
            }

            setAvatarUrl(null);
            setMessage({ type: "success", text: "Profile picture removed!" });
            router.refresh();
        } catch (error) {
            setMessage({
                type: "error",
                text: error instanceof Error ? error.message : "Failed to delete image",
            });
        } finally {
            setIsDeletingAvatar(false);
        }
    };

    const handleCameraCapture = async (file: File) => {
        setIsUploadingAvatar(true);
        setMessage(null);

        try {
            const result = await profileService.uploadAvatar(user.id, file);

            if (result.error) {
                throw new Error(result.error);
            }

            if (result.url) {
                setAvatarUrl(result.url);
                setMessage({ type: "success", text: "Profile picture updated!" });
                router.refresh();
            }
        } catch (error) {
            setMessage({
                type: "error",
                text: error instanceof Error ? error.message : "Failed to upload image",
            });
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const currencies = [
        { value: "USD", label: "US Dollar ($)" },
        { value: "EUR", label: "Euro (€)" },
        { value: "GBP", label: "British Pound (£)" },
        { value: "INR", label: "Indian Rupee (₹)" },
        { value: "CAD", label: "Canadian Dollar (C$)" },
        { value: "AUD", label: "Australian Dollar (A$)" },
        { value: "JPY", label: "Japanese Yen (¥)" },
        { value: "CNY", label: "Chinese Yuan (¥)" },
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
            {/* Global message */}
            {message && (
                <div
                    className={`rounded-lg p-4 text-sm ${message.type === "success"
                        ? "border border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400"
                        : "border border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
                        }`}
                >
                    {message.text}
                </div>
            )}

            {/* Avatar section */}
            <Card>
                <CardHeader>
                    <CardTitle>Profile Picture</CardTitle>
                    <CardDescription>
                        Upload a profile picture. Max size 2MB.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-6">
                        {/* Avatar preview */}
                        <div className="relative">
                            {avatarUrl ? (
                                <Image
                                    src={avatarUrl}
                                    alt={user.full_name || "Profile"}
                                    width={80}
                                    height={80}
                                    className="h-20 w-20 rounded-full object-cover ring-4 ring-gray-100 dark:ring-gray-800"
                                    unoptimized
                                />
                            ) : (
                                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-600 text-2xl font-semibold text-white ring-4 ring-gray-100 dark:ring-gray-800">
                                    {initials}
                                </div>
                            )}

                            {/* Upload overlay */}
                            {isUploadingAvatar && (
                                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-wrap gap-2">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/gif,image/webp"
                                    onChange={handleAvatarChange}
                                    className="hidden"
                                    id="avatar-upload"
                                />
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploadingAvatar || isDeletingAvatar}
                                >
                                    {isUploadingAvatar ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Upload className="mr-2 h-4 w-4" />
                                    )}
                                    Upload
                                </Button>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsCameraOpen(true)}
                                    disabled={isUploadingAvatar || isDeletingAvatar}
                                >
                                    <Camera className="mr-2 h-4 w-4" />
                                    Take Photo
                                </Button>

                                {avatarUrl && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleDeleteAvatar}
                                        disabled={isUploadingAvatar || isDeletingAvatar}
                                        className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                                    >
                                        {isDeletingAvatar ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="mr-2 h-4 w-4" />
                                        )}
                                        Remove
                                    </Button>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                JPG, PNG, GIF or WebP. Max 2MB.
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

                        <div className="flex justify-end gap-3">
                            <Button
                                type="submit"
                                isLoading={isLoading}
                                disabled={!isDirty || isLoading}
                            >
                                Save Changes
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {/* Account info */}
            <Card>
                <CardHeader>
                    <CardTitle>Account Information</CardTitle>
                    <CardDescription>Your account details</CardDescription>
                </CardHeader>
                <CardContent>
                    <dl className="space-y-4 text-sm">
                        <div className="flex justify-between">
                            <dt className="text-gray-500 dark:text-gray-400">User ID</dt>
                            <dd className="font-mono text-gray-900 dark:text-white">
                                {user.id.slice(0, 8)}...
                            </dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-gray-500 dark:text-gray-400">Email</dt>
                            <dd className="text-gray-900 dark:text-white">{user.email}</dd>
                        </div>
                    </dl>
                </CardContent>
            </Card>

            {/* Camera Capture Modal */}
            <CameraCapture
                isOpen={isCameraOpen}
                onClose={() => setIsCameraOpen(false)}
                onCapture={handleCameraCapture}
            />
        </div>
    );
}
