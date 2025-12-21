"use client";

import { useState, useTransition } from "react";
import {
    Shield, ShieldOff, Clock, Hash, RefreshCw, Check, X,
    AlertTriangle, Zap, Lock, Globe, Wallet
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { updateRateLimitSetting } from "./actions";

interface RateLimitSetting {
    id: string;
    route_pattern: string;
    route_name: string;
    description: string | null;
    rate_limit_type: string;
    is_enabled: boolean;
    requests_limit: number;
    window_duration: string;
    updated_at: string | null;
}

interface RateLimitSettingsClientProps {
    initialSettings: RateLimitSetting[];
    userId: string;
}

const typeConfig: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
    auth: { icon: Lock, color: "text-red-600 dark:text-red-400", bgColor: "bg-red-100 dark:bg-red-900/30" },
    sensitive: { icon: AlertTriangle, color: "text-orange-600 dark:text-orange-400", bgColor: "bg-orange-100 dark:bg-orange-900/30" },
    public: { icon: Globe, color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-100 dark:bg-blue-900/30" },
    expensive: { icon: Zap, color: "text-purple-600 dark:text-purple-400", bgColor: "bg-purple-100 dark:bg-purple-900/30" },
    api: { icon: Shield, color: "text-teal-600 dark:text-teal-400", bgColor: "bg-teal-100 dark:bg-teal-900/30" },
    invite: { icon: Wallet, color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-100 dark:bg-amber-900/30" },
    financial: { icon: Wallet, color: "text-green-600 dark:text-green-400", bgColor: "bg-green-100 dark:bg-green-900/30" },
    write: { icon: Shield, color: "text-indigo-600 dark:text-indigo-400", bgColor: "bg-indigo-100 dark:bg-indigo-900/30" },
};

export function RateLimitSettingsClient({ initialSettings, userId }: RateLimitSettingsClientProps) {
    const [settings, setSettings] = useState(initialSettings);
    const [isPending, startTransition] = useTransition();
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const toast = useToast();

    const handleToggle = async (setting: RateLimitSetting) => {
        setUpdatingId(setting.id);

        startTransition(async () => {
            const result = await updateRateLimitSetting(setting.id, !setting.is_enabled, userId);

            if (result.success) {
                setSettings(prev => prev.map(s =>
                    s.id === setting.id
                        ? { ...s, is_enabled: !s.is_enabled, updated_at: new Date().toISOString() }
                        : s
                ));
                toast.success(
                    `Rate limiting ${!setting.is_enabled ? "enabled" : "disabled"} for ${setting.route_name}`
                );
            } else {
                toast.error(result.error || "Failed to update setting");
            }

            setUpdatingId(null);
        });
    };

    const enabledCount = settings.filter(s => s.is_enabled).length;
    const disabledCount = settings.filter(s => !s.is_enabled).length;

    return (
        <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                                <Shield className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{settings.length}</p>
                                <p className="text-xs text-gray-500">Total Routes</p>
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
                                <p className="text-xs text-gray-500">Protected</p>
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
                                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{disabledCount}</p>
                                <p className="text-xs text-gray-500">Disabled</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                                <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {new Set(settings.map(s => s.rate_limit_type)).size}
                                </p>
                                <p className="text-xs text-gray-500">Limit Types</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Settings List */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Route Configuration</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {settings.map((setting) => {
                            const config = typeConfig[setting.rate_limit_type] || typeConfig.api;
                            const Icon = config.icon;
                            const isUpdating = updatingId === setting.id;

                            return (
                                <div
                                    key={setting.id}
                                    className={cn(
                                        "flex items-center justify-between p-4 transition-colors",
                                        !setting.is_enabled && "bg-red-50/50 dark:bg-red-950/10"
                                    )}
                                >
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                        {/* Type Icon */}
                                        <div className={cn("flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg", config.bgColor)}>
                                            <Icon className={cn("h-5 w-5", config.color)} />
                                        </div>

                                        {/* Route Info */}
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-medium text-gray-900 dark:text-white truncate">
                                                    {setting.route_name}
                                                </h3>
                                                <Badge
                                                    variant={setting.is_enabled ? "success" : "danger"}
                                                    className="text-[10px]"
                                                >
                                                    {setting.is_enabled ? "Active" : "Disabled"}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                                {setting.route_pattern}
                                            </p>
                                            {setting.description && (
                                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                                    {setting.description}
                                                </p>
                                            )}
                                        </div>

                                        {/* Limit Info */}
                                        <div className="hidden md:flex items-center gap-4 text-sm">
                                            <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                                                <Hash className="h-4 w-4" />
                                                <span>{setting.requests_limit} req</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                                                <Clock className="h-4 w-4" />
                                                <span>{setting.window_duration}</span>
                                            </div>
                                            <Badge variant="default" className="capitalize">
                                                {setting.rate_limit_type}
                                            </Badge>
                                        </div>
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
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Legend */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Rate Limit Types
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        {Object.entries(typeConfig).map(([type, config]) => {
                            const Icon = config.icon;
                            return (
                                <div key={type} className="flex items-center gap-2">
                                    <div className={cn("flex h-6 w-6 items-center justify-center rounded", config.bgColor)}>
                                        <Icon className={cn("h-3 w-3", config.color)} />
                                    </div>
                                    <span className="text-gray-600 dark:text-gray-400 capitalize">{type}</span>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

