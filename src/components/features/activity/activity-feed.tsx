"use client";

import { formatDistanceToNow } from "date-fns";
import Image from "next/image";
import {
    Receipt,
    UserPlus,
    Users,
    Trash2,
    Edit,
    Banknote,
    Bell,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/components/ui/link";
// Note: URL ID encryption happens on server only, client uses plain IDs
import type { ActivityWithDetails } from "@/services/activities.server";

interface ActivityFeedProps {
    activities: ActivityWithDetails[];
    showGroupName?: boolean;
    /** Pre-encrypted group IDs from server component */
    encryptedGroupIds?: Record<string, string>;
}

const actionIcons: Record<string, React.ReactNode> = {
    created: <Receipt className="h-4 w-4" />,
    deleted: <Trash2 className="h-4 w-4" />,
    updated: <Edit className="h-4 w-4" />,
    joined: <UserPlus className="h-4 w-4" />,
    left: <UserPlus className="h-4 w-4" />,
    settled: <Banknote className="h-4 w-4" />,
};

const entityTypeIcons: Record<string, React.ReactNode> = {
    expense: <Receipt className="h-4 w-4" />,
    group: <Users className="h-4 w-4" />,
    member: <UserPlus className="h-4 w-4" />,
    settlement: <Banknote className="h-4 w-4" />,
};

const actionColors: Record<string, string> = {
    created: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
    deleted: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
    updated: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    joined: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
    left: "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400",
    settled: "bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400",
};

function getActivityMessage(activity: ActivityWithDetails): string {
    const userName = activity.user_profile?.full_name || "Someone";
    const metadata = activity.metadata as Record<string, unknown> | null;

    switch (activity.entity_type) {
        case "expense":
            if (activity.action === "created") {
                const amount = metadata?.amount as number;
                const description = metadata?.description as string;
                return `${userName} added "${description}" for $${amount?.toFixed(2) || "0.00"}`;
            }
            if (activity.action === "deleted") {
                const description = metadata?.description as string;
                return `${userName} deleted expense "${description}"`;
            }
            if (activity.action === "updated") {
                return `${userName} updated an expense`;
            }
            break;
        case "group":
            if (activity.action === "created") {
                return `${userName} created the group`;
            }
            if (activity.action === "updated") {
                return `${userName} updated group settings`;
            }
            break;
        case "member":
            if (activity.action === "joined") {
                const memberName = metadata?.member_name as string;
                return memberName
                    ? `${userName} added ${memberName} to the group`
                    : `${userName} joined the group`;
            }
            if (activity.action === "left") {
                return `${userName} left the group`;
            }
            break;
        case "settlement":
            if (activity.action === "created") {
                const amount = metadata?.amount as number;
                return `${userName} recorded a payment of $${amount?.toFixed(2) || "0.00"}`;
            }
            break;
    }

    return `${userName} performed an action`;
}

export function ActivityFeed({ activities, showGroupName = true, encryptedGroupIds = {} }: ActivityFeedProps) {
    if (!activities || activities.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-16 dark:border-gray-800">
                <div className="rounded-full bg-gray-100 p-4 dark:bg-gray-800">
                    <Bell className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                    No activity yet
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Activity will appear here when you start using groups
                </p>
            </div>
        );
    }

    // Group activities by date
    const groupedActivities = (activities || []).reduce((groups, activity) => {
        const date = new Date(activity.created_at || "").toDateString();
        if (!groups[date]) {
            groups[date] = [];
        }
        groups[date].push(activity);
        return groups;
    }, {} as Record<string, ActivityWithDetails[]>);

    const now = new Date();
    const today = now.toDateString();
    const yesterday = new Date(now.getTime() - 86400000).toDateString();

    const formatDateHeader = (dateStr: string): string => {
        if (dateStr === today) return "Today";
        if (dateStr === yesterday) return "Yesterday";
        return new Date(dateStr).toLocaleDateString("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric",
        });
    };

    return (
        <div className="space-y-6">
            {Object.entries(groupedActivities).map(([date, dateActivities]) => (
                <div key={date}>
                    <h3 className="mb-3 text-sm font-medium text-gray-500 dark:text-gray-400">
                        {formatDateHeader(date)}
                    </h3>
                    <div className="space-y-3">
                        {dateActivities.map((activity) => {
                            const icon = actionIcons[activity.action] || entityTypeIcons[activity.entity_type || ""] || <Bell className="h-4 w-4" />;
                            const colorClass = actionColors[activity.action] || "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";

                            return (
                                <Card key={activity.id} className="transition-shadow hover:shadow-md">
                                    <CardContent className="p-4">
                                        <div className="flex items-start gap-3">
                                            {/* User Avatar */}
                                            <div className="relative">
                                                {activity.user_profile?.avatar_url ? (
                                                    <Image
                                                        src={activity.user_profile.avatar_url}
                                                        alt={activity.user_profile.full_name || "User"}
                                                        width={40}
                                                        height={40}
                                                        className="h-10 w-10 rounded-full object-cover"
                                                        unoptimized
                                                    />
                                                ) : (
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                                        {activity.user_profile?.full_name?.[0]?.toUpperCase() || "?"}
                                                    </div>
                                                )}
                                                {/* Action icon badge */}
                                                <div className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ${colorClass}`}>
                                                    {icon}
                                                </div>
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-gray-900 dark:text-white">
                                                    {getActivityMessage(activity)}
                                                </p>
                                                <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                                    <span suppressHydrationWarning>
                                                        {formatDistanceToNow(new Date(activity.created_at || ""), { addSuffix: true })}
                                                    </span>
                                                    {showGroupName && activity.group && (
                                                        <>
                                                            <span>•</span>
                                                            <Link
                                                                href={`/groups/${encryptedGroupIds[activity.group.id] || activity.group.id}`}
                                                                className="text-teal-600 hover:underline dark:text-teal-400"
                                                            >
                                                                {activity.group.name}
                                                            </Link>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}

