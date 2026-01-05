"use client";

import { useState, useTransition } from "react";
import {
    Shield, ShieldOff, Settings, RefreshCw, Check, X,
    AlertTriangle, Bell, Lock, Eye, EyeOff, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { updateAppSetting, updateRecaptchaConfig } from "./actions";

// ============================================
// TYPES
// ============================================

interface AppSetting {
    id: string;
    key: string;
    value: Record<string, unknown>;
    is_enabled: boolean;
    description: string | null;
    category: string;
    updated_at: string | null;
}

interface AppSettingsClientProps {
    initialSettings: AppSetting[];
    userId: string;
    recaptchaConfigured: boolean;
}

// ============================================
// CATEGORY CONFIG
// ============================================

const categoryConfig: Record<string, { icon: React.ElementType; color: string; bgColor: string; label: string }> = {
    security: { icon: Shield, color: "text-red-600 dark:text-red-400", bgColor: "bg-red-100 dark:bg-red-900/30", label: "Security" },
    general: { icon: Settings, color: "text-gray-600 dark:text-gray-400", bgColor: "bg-gray-100 dark:bg-gray-800", label: "General" },
    notifications: { icon: Bell, color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-100 dark:bg-blue-900/30", label: "Notifications" },
};

const settingLabels: Record<string, string> = {
    recaptcha: "reCAPTCHA v3",
    maintenance_mode: "Maintenance Mode",
    email_notifications: "Email Notifications",
};

// ============================================
// COMPONENT
// ============================================

export function AppSettingsClient({ initialSettings, userId, recaptchaConfigured }: AppSettingsClientProps) {
    const [settings, setSettings] = useState(initialSettings);
    const [isPending, startTransition] = useTransition();
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const toast = useToast();

    // reCAPTCHA config state
    const [scoreThreshold, setScoreThreshold] = useState<number>(
        (initialSettings.find(s => s.key === "recaptcha")?.value?.score_threshold as number) ?? 0.5
    );

    const handleToggle = async (setting: AppSetting) => {
        // Special check for reCAPTCHA
        if (setting.key === "recaptcha" && !recaptchaConfigured && !setting.is_enabled) {
            toast.error("Cannot enable reCAPTCHA: Environment variables not configured. Please add NEXT_PUBLIC_RECAPTCHA_SITE_KEY and RECAPTCHA_SECRET_KEY.");
            return;
        }

        setUpdatingId(setting.id);

        startTransition(async () => {
            const result = await updateAppSetting(setting.id, !setting.is_enabled, userId);

            if (result.success) {
                setSettings(prev => prev.map(s =>
                    s.id === setting.id
                        ? { ...s, is_enabled: !s.is_enabled, updated_at: new Date().toISOString() }
                        : s
                ));
                toast.success(
                    `${settingLabels[setting.key] || setting.key} ${!setting.is_enabled ? "enabled" : "disabled"}`
                );
            } else {
                toast.error(result.error || "Failed to update setting");
            }

            setUpdatingId(null);
        });
    };

    const handleUpdateRecaptchaConfig = async () => {
        const setting = settings.find(s => s.key === "recaptcha");
        if (!setting) return;

        setUpdatingId(setting.id);

        startTransition(async () => {
            const result = await updateRecaptchaConfig(setting.id, { score_threshold: scoreThreshold }, userId);

            if (result.success) {
                setSettings(prev => prev.map(s =>
                    s.id === setting.id
                        ? { ...s, value: { ...s.value, score_threshold: scoreThreshold }, updated_at: new Date().toISOString() }
                        : s
                ));
                toast.success("reCAPTCHA configuration updated");
            } else {
                toast.error(result.error || "Failed to update configuration");
            }

            setUpdatingId(null);
        });
    };

    // Group settings by category
    const groupedSettings = settings.reduce((acc, setting) => {
        const category = setting.category || "general";
        if (!acc[category]) acc[category] = [];
        acc[category].push(setting);
        return acc;
    }, {} as Record<string, AppSetting[]>);

    const enabledCount = settings.filter(s => s.is_enabled).length;

    return (
        <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                                <Settings className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{settings.length}</p>
                                <p className="text-xs text-gray-500">Total Settings</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                                <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{enabledCount}</p>
                                <p className="text-xs text-gray-500">Enabled</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
                                <X className="h-5 w-5 text-red-600 dark:text-red-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{settings.length - enabledCount}</p>
                                <p className="text-xs text-gray-500">Disabled</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "flex h-10 w-10 items-center justify-center rounded-lg",
                                recaptchaConfigured ? "bg-green-100 dark:bg-green-900/30" : "bg-yellow-100 dark:bg-yellow-900/30"
                            )}>
                                <Lock className={cn(
                                    "h-5 w-5",
                                    recaptchaConfigured ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400"
                                )} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    {recaptchaConfigured ? "Configured" : "Not Set"}
                                </p>
                                <p className="text-xs text-gray-500">reCAPTCHA Keys</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Settings by Category */}
            {Object.entries(groupedSettings).map(([category, categorySettings]) => {
                const config = categoryConfig[category] || categoryConfig.general;
                const CategoryIcon = config.icon;

                return (
                    <Card key={category}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", config.bgColor)}>
                                    <CategoryIcon className={cn("h-4 w-4", config.color)} />
                                </div>
                                {config.label}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                {categorySettings.map((setting) => {
                                    const isUpdating = updatingId === setting.id;
                                    const isExpanded = expandedId === setting.id;
                                    const isRecaptcha = setting.key === "recaptcha";

                                    return (
                                        <div key={setting.id}>
                                            <div
                                                className={cn(
                                                    "flex items-center justify-between p-4 transition-colors",
                                                    !setting.is_enabled && "bg-gray-50/50 dark:bg-gray-900/20"
                                                )}
                                            >
                                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                                    {/* Status Icon */}
                                                    <div className={cn(
                                                        "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg",
                                                        setting.is_enabled
                                                            ? "bg-green-100 dark:bg-green-900/30"
                                                            : "bg-gray-100 dark:bg-gray-800"
                                                    )}>
                                                        {setting.is_enabled ? (
                                                            <Shield className="h-5 w-5 text-green-600 dark:text-green-400" />
                                                        ) : (
                                                            <ShieldOff className="h-5 w-5 text-gray-400" />
                                                        )}
                                                    </div>

                                                    {/* Setting Info */}
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="font-medium text-gray-900 dark:text-white">
                                                                {settingLabels[setting.key] || setting.key}
                                                            </h3>
                                                            <Badge
                                                                variant={setting.is_enabled ? "success" : "default"}
                                                                className="text-[10px]"
                                                            >
                                                                {setting.is_enabled ? "Enabled" : "Disabled"}
                                                            </Badge>
                                                            {isRecaptcha && !recaptchaConfigured && (
                                                                <Badge variant="warning" className="text-[10px]">
                                                                    Keys Missing
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        {setting.description && (
                                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                                                                {setting.description}
                                                            </p>
                                                        )}
                                                    </div>

                                                    {/* Expand Button for reCAPTCHA */}
                                                    {isRecaptcha && setting.is_enabled && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setExpandedId(isExpanded ? null : setting.id)}
                                                        >
                                                            {isExpanded ? (
                                                                <EyeOff className="h-4 w-4" />
                                                            ) : (
                                                                <Eye className="h-4 w-4" />
                                                            )}
                                                            <span className="ml-1">{isExpanded ? "Hide" : "Configure"}</span>
                                                        </Button>
                                                    )}
                                                </div>

                                                {/* Toggle Button */}
                                                <div className="ml-4">
                                                    <button
                                                        onClick={() => handleToggle(setting)}
                                                        disabled={isPending}
                                                        className={cn(
                                                            "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900",
                                                            setting.is_enabled
                                                                ? "bg-teal-500"
                                                                : "bg-gray-200 dark:bg-gray-700",
                                                            (isPending || isUpdating) && "opacity-50 cursor-not-allowed"
                                                        )}
                                                    >
                                                        <span
                                                            className={cn(
                                                                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                                                                setting.is_enabled ? "translate-x-5" : "translate-x-0"
                                                            )}
                                                        >
                                                            {isUpdating && (
                                                                <RefreshCw className="h-3 w-3 animate-spin absolute top-1 left-1 text-gray-400" />
                                                            )}
                                                        </span>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* reCAPTCHA Configuration Panel */}
                                            {isRecaptcha && isExpanded && setting.is_enabled && (
                                                <div className="px-4 pb-4 pt-0 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/20">
                                                    <div className="mt-4 space-y-4">
                                                        <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-sm">
                                                            <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                                            <p>
                                                                reCAPTCHA v3 returns a score between 0.0 and 1.0. Higher scores indicate more likely human users.
                                                                The default threshold of 0.5 is recommended.
                                                            </p>
                                                        </div>

                                                        <div className="grid gap-4 sm:grid-cols-2">
                                                            <div>
                                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                                    Score Threshold
                                                                </label>
                                                                <div className="flex items-center gap-2">
                                                                    <Input
                                                                        type="number"
                                                                        min="0"
                                                                        max="1"
                                                                        step="0.1"
                                                                        value={scoreThreshold}
                                                                        onChange={(e) => setScoreThreshold(parseFloat(e.target.value) || 0.5)}
                                                                        className="w-24"
                                                                    />
                                                                    <span className="text-sm text-gray-500">
                                                                        (0.0 - 1.0)
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            <div>
                                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                                    Protected Actions
                                                                </label>
                                                                <div className="flex flex-wrap gap-1">
                                                                    {((setting.value?.actions as string[]) || []).map((action) => (
                                                                        <Badge key={action} variant="default">
                                                                            {action}
                                                                        </Badge>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex justify-end">
                                                            <Button
                                                                size="sm"
                                                                onClick={handleUpdateRecaptchaConfig}
                                                                disabled={isPending}
                                                                isLoading={isUpdating}
                                                            >
                                                                Save Configuration
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                );
            })}

            {/* Warning for Missing reCAPTCHA Keys */}
            {!recaptchaConfigured && (
                <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                            <AlertTriangle className="h-5 w-5" />
                            reCAPTCHA Configuration Required
                        </CardTitle>
                        <CardDescription className="text-yellow-600 dark:text-yellow-500">
                            To enable reCAPTCHA protection, add these environment variables:
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="font-mono text-sm bg-gray-900 text-gray-100 p-4 rounded-lg space-y-1">
                            <p>NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your_site_key</p>
                            <p>RECAPTCHA_SECRET_KEY=your_secret_key</p>
                        </div>
                        <p className="mt-3 text-sm text-yellow-600 dark:text-yellow-500">
                            Get your keys from the{" "}
                            <a
                                href="https://www.google.com/recaptcha/admin"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline hover:no-underline"
                            >
                                Google reCAPTCHA Admin Console
                            </a>
                            . Select reCAPTCHA v3 when creating your site.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

