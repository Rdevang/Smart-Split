"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, User, UserRoundPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { groupsService } from "@/services/groups";

interface AddMemberFormProps {
    groupId: string;
    userId: string;
}

type MemberType = "existing" | "placeholder";

export function AddMemberForm({ groupId, userId }: AddMemberFormProps) {
    const router = useRouter();
    const [memberType, setMemberType] = useState<MemberType>("existing");
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [placeholderEmail, setPlaceholderEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setSuccess(false);

        let result;

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
        } else {
            setSuccess(true);
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
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => {
                        setMemberType("existing");
                        setError(null);
                        setSuccess(false);
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${memberType === "existing"
                            ? "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                        }`}
                >
                    <User className="h-4 w-4" />
                    Existing User
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setMemberType("placeholder");
                        setError(null);
                        setSuccess(false);
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${memberType === "placeholder"
                            ? "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                        }`}
                >
                    <UserRoundPlus className="h-4 w-4" />
                    New Person
                </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
                {memberType === "existing" ? (
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <Input
                                type="email"
                                placeholder="Enter email address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                error={error || undefined}
                            />
                        </div>
                        <Button type="submit" isLoading={isLoading} disabled={!email}>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Add
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Add someone who hasn&apos;t signed up yet. They can join later and take over this account.
                        </p>
                        <div className="flex gap-3">
                            <div className="flex-1">
                                <Input
                                    type="text"
                                    placeholder="Name (e.g., John, Mom)"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    error={error || undefined}
                                />
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className="flex-1">
                                <Input
                                    type="email"
                                    placeholder="Email (optional - for inviting later)"
                                    value={placeholderEmail}
                                    onChange={(e) => setPlaceholderEmail(e.target.value)}
                                />
                            </div>
                            <Button type="submit" isLoading={isLoading} disabled={!name.trim()}>
                                <UserPlus className="mr-2 h-4 w-4" />
                                Add
                            </Button>
                        </div>
                    </div>
                )}

                {success && (
                    <p className="text-sm text-green-600 dark:text-green-400">
                        Member added successfully!
                    </p>
                )}
            </form>
        </div>
    );
}
