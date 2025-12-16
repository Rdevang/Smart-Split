"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, User, UserRoundPlus, Users } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { groupsService } from "@/services/groups";
import { friendsService, type PastMember } from "@/services/friends";
import { onMemberAdded } from "@/app/(dashboard)/actions";

interface AddMemberFormProps {
    groupId: string;
    userId: string;
    existingMemberIds?: string[]; // IDs of members already in this group
    existingMemberNames?: string[]; // Names of placeholder members (for name-based filtering)
}

type MemberType = "friends" | "existing" | "placeholder";

export function AddMemberForm({ groupId, userId, existingMemberIds = [], existingMemberNames = [] }: AddMemberFormProps) {
    const router = useRouter();
    const toast = useToast();
    const [memberType, setMemberType] = useState<MemberType>("friends");
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [placeholderEmail, setPlaceholderEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Friends from past trips
    const [friends, setFriends] = useState<PastMember[]>([]);
    const [loadingFriends, setLoadingFriends] = useState(true);
    const [addingFriendId, setAddingFriendId] = useState<string | null>(null);

    useEffect(() => {
        loadFriends();
    }, [userId]);

    const loadFriends = async () => {
        setLoadingFriends(true);
        const data = await friendsService.getPastGroupMembers(userId);
        // Filter out members already in this group
        // For real users: check by ID
        // For placeholders: check by name (case-insensitive) since same person can have different IDs
        const existingNamesLower = existingMemberNames.map((n) => n.toLowerCase().trim());
        const available = data.filter((f) => {
            if (f.is_placeholder) {
                // Check by name for placeholders
                return !existingNamesLower.includes(f.name.toLowerCase().trim());
            }
            // Check by ID for real users
            return !existingMemberIds.includes(f.id);
        });
        setFriends(available);
        setLoadingFriends(false);
    };

    const handleAddFriend = async (friend: PastMember) => {
        setAddingFriendId(friend.id);
        setError(null);

        let result;
        if (friend.is_placeholder) {
            // Add as placeholder member
            result = await groupsService.addPlaceholderMember(
                groupId,
                friend.name,
                friend.email || null,
                userId
            );
        } else {
            // Add as existing user
            result = await groupsService.addMember(groupId, friend.email, userId);
        }

        if (!result.success) {
            toast.error(result.error || "Failed to add member");
        } else {
            // Invalidate cache for the group
            await onMemberAdded(groupId, friend.is_placeholder ? undefined : friend.id);
            toast.success(`${friend.name} added to group!`);
            // Remove from available friends list
            setFriends((prev) => prev.filter((f) => f.id !== friend.id));
            router.refresh();
        }

        setAddingFriendId(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        let result: { success: boolean; error?: string; inviteSent?: boolean };

        if (memberType === "existing") {
            if (!email) {
                setError("Email is required");
                setIsLoading(false);
                return;
            }
            result = await groupsService.addMember(groupId, email, userId);
        } else {
            if (!name.trim()) {
                setError("Name is required");
                setIsLoading(false);
                return;
            }
            result = await groupsService.addPlaceholderMember(
                groupId,
                name,
                placeholderEmail || null,
                userId
            );
        }

        if (!result.success) {
            setError(result.error || "Failed to add member");
            toast.error(result.error || "Failed to add member");
        } else {
            // Invalidate cache for the group
            await onMemberAdded(groupId);
            
            if (result.inviteSent) {
                toast.success("Invitation sent! They will be notified.");
            } else {
                toast.success("Member added successfully!");
            }
            setEmail("");
            setName("");
            setPlaceholderEmail("");
            router.refresh();
        }

        setIsLoading(false);
    };

    return (
        <div className="space-y-4">
            {/* Toggle Buttons */}
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={() => {
                        setMemberType("friends");
                        setError(null);
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${memberType === "friends"
                        ? "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                        }`}
                >
                    <Users className="h-3.5 w-3.5" />
                    From Trips
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setMemberType("existing");
                        setError(null);
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${memberType === "existing"
                        ? "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                        }`}
                >
                    <User className="h-3.5 w-3.5" />
                    By Email
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setMemberType("placeholder");
                        setError(null);
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${memberType === "placeholder"
                        ? "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                        }`}
                >
                    <UserRoundPlus className="h-3.5 w-3.5" />
                    New Person
                </button>
            </div>

            {/* Friends from past trips */}
            {memberType === "friends" && (
                <div className="space-y-2">
                    {loadingFriends ? (
                        <p className="text-sm text-gray-400">Loading friends...</p>
                    ) : friends.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            No friends available to add. Use &quot;By Email&quot; or &quot;New Person&quot; to add members.
                        </p>
                    ) : (
                        <div className="max-h-48 overflow-y-auto space-y-2">
                            {friends.slice(0, 10).map((friend) => (
                                <div
                                    key={friend.is_placeholder ? `p-${friend.id}` : friend.id}
                                    className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        {friend.avatar_url ? (
                                            <Image
                                                src={friend.avatar_url}
                                                alt={friend.name}
                                                width={28}
                                                height={28}
                                                className="rounded-full"
                                                unoptimized
                                            />
                                        ) : (
                                            <div
                                                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs text-white font-medium ${friend.is_placeholder ? "bg-gray-400" : "bg-teal-500"
                                                    }`}
                                            >
                                                {friend.name[0].toUpperCase()}
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1">
                                                <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                    {friend.name}
                                                </span>
                                                {friend.is_placeholder && (
                                                    <Badge variant="warning" className="text-[9px] px-1">
                                                        Not signed up
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleAddFriend(friend)}
                                        isLoading={addingFriendId === friend.id}
                                        className="h-7 px-2 text-xs"
                                    >
                                        <UserPlus className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Existing user by email */}
            {memberType === "existing" && (
                <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <Input
                                type="email"
                                placeholder="Enter email address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                error={error || undefined}
                                className="h-9 text-sm"
                            />
                        </div>
                        <Button type="submit" isLoading={isLoading} disabled={!email} size="sm">
                            <UserPlus className="mr-1 h-3.5 w-3.5" />
                            Add
                        </Button>
                    </div>
                </form>
            )}

            {/* New person (placeholder) */}
            {memberType === "placeholder" && (
                <form onSubmit={handleSubmit} className="space-y-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Add someone who hasn&apos;t signed up yet.
                    </p>
                    <Input
                        type="text"
                        placeholder="Name (e.g., John, Mom)"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        error={error || undefined}
                        className="h-9 text-sm"
                    />
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <Input
                                type="email"
                                placeholder="Email (optional)"
                                value={placeholderEmail}
                                onChange={(e) => setPlaceholderEmail(e.target.value)}
                                className="h-9 text-sm"
                            />
                        </div>
                        <Button type="submit" isLoading={isLoading} disabled={!name.trim()} size="sm">
                            <UserPlus className="mr-1 h-3.5 w-3.5" />
                            Add
                        </Button>
                    </div>
                </form>
            )}

            {/* Error message for friends tab (forms have inline errors) */}
            {error && memberType === "friends" && (
                <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            )}
        </div>
    );
}
