"use client";

import Link from "next/link";
import { Users, Calendar, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Generic group type that works with both client and server services
interface GroupCardGroup {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    updated_at: string | null;
    member_count: number;
}

interface GroupCardProps {
    group: GroupCardGroup;
}

const categoryColors: Record<string, "default" | "primary" | "success" | "warning" | "danger" | "info"> = {
    trip: "info",
    home: "success",
    couple: "danger",
    other: "default",
};

const categoryEmojis: Record<string, string> = {
    trip: "✈️",
    home: "🏠",
    couple: "❤️",
    other: "📋",
};

export function GroupCard({ group }: GroupCardProps) {
    const category = group.category || "other";
    const emoji = categoryEmojis[category] || "📋";
    const formattedDate = group.updated_at
        ? new Date(group.updated_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
        })
        : "N/A";

    return (
        <Link href={`/groups/${group.id}`}>
            <Card className="group cursor-pointer transition-all hover:border-teal-300 hover:shadow-md dark:hover:border-teal-600">
                <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-teal-50 to-teal-100 text-2xl dark:from-teal-900/30 dark:to-teal-800/30">
                                {emoji}
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-gray-900 group-hover:text-teal-600 dark:text-white dark:group-hover:text-teal-400">
                                    {group.name}
                                </h3>
                                {group.description && (
                                    <p className="mt-1 line-clamp-1 text-sm text-gray-500 dark:text-gray-400">
                                        {group.description}
                                    </p>
                                )}
                                <div className="mt-3 flex flex-wrap items-center gap-3">
                                    <Badge variant={categoryColors[category]}>
                                        {category.charAt(0).toUpperCase() + category.slice(1)}
                                    </Badge>
                                    <span className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                                        <Users className="h-4 w-4" />
                                        {group.member_count} {group.member_count === 1 ? "member" : "members"}
                                    </span>
                                    <span className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                                        <Calendar className="h-4 w-4" />
                                        {formattedDate}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-400 transition-transform group-hover:translate-x-1 group-hover:text-teal-500" />
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}

