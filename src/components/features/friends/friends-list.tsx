"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { Users, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface PastMember {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
    is_placeholder: boolean;
    groups_shared: number;
}

interface FriendsListProps {
    initialMembers: PastMember[];
}

export function FriendsList({ initialMembers }: FriendsListProps) {
    const [searchQuery, setSearchQuery] = useState("");

    const filteredMembers = useMemo(() => {
        if (searchQuery.trim()) {
            const lowerQuery = searchQuery.toLowerCase();
            return initialMembers.filter(
                (m) =>
                    m.name.toLowerCase().includes(lowerQuery) ||
                    m.email.toLowerCase().includes(lowerQuery)
            );
        }
        return initialMembers;
    }, [searchQuery, initialMembers]);

    return (
        <div className="space-y-6">
            {/* Search */}
            {initialMembers.length > 0 && (
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                        type="text"
                        placeholder="Search by name or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
            )}

            {/* Stats */}
            {initialMembers.length > 0 && (
                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                    <span>{initialMembers.length} people from your trips</span>
                    <span>•</span>
                    <span>{initialMembers.filter((m) => !m.is_placeholder).length} registered</span>
                    <span>•</span>
                    <span>{initialMembers.filter((m) => m.is_placeholder).length} not signed up</span>
                </div>
            )}

            {/* Members List */}
            {filteredMembers.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center py-12">
                        <Users className="h-12 w-12 text-gray-300 dark:text-gray-600" />
                        <p className="mt-4 text-gray-500 dark:text-gray-400">
                            {searchQuery ? "No matches found" : "No trip members yet"}
                        </p>
                        <p className="text-sm text-gray-400 dark:text-gray-500">
                            {searchQuery
                                ? "Try a different search term"
                                : "People you add to groups will appear here"}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredMembers.map((member) => (
                        <Card key={member.is_placeholder ? `p-${member.id}` : member.id}>
                            <CardContent className="flex items-center justify-between p-4">
                                <div className="flex items-center gap-3">
                                    {member.avatar_url ? (
                                        <Image
                                            src={member.avatar_url}
                                            alt={member.name}
                                            width={40}
                                            height={40}
                                            className="h-10 w-10 rounded-full object-cover"
                                            unoptimized
                                        />
                                    ) : (
                                        <div
                                            className={`flex h-10 w-10 items-center justify-center rounded-full text-white font-medium ${member.is_placeholder ? "bg-gray-400" : "bg-teal-500"
                                                }`}
                                        >
                                            {member.name[0].toUpperCase()}
                                        </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium text-gray-900 dark:text-white truncate">
                                                {member.name}
                                            </p>
                                            {member.is_placeholder && (
                                                <Badge variant="warning" className="text-[10px] shrink-0">
                                                    Not signed up
                                                </Badge>
                                            )}
                                        </div>
                                        {member.email && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                {member.email}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right shrink-0 ml-2">
                                    <p className="text-xs text-gray-400 dark:text-gray-500">
                                        {member.groups_shared} {member.groups_shared === 1 ? "trip" : "trips"}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
