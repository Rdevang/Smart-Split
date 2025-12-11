"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { groupsService } from "@/services/groups";

interface AddMemberFormProps {
    groupId: string;
    userId: string;
}

export function AddMemberForm({ groupId, userId }: AddMemberFormProps) {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setSuccess(false);

        const result = await groupsService.addMember(groupId, email, userId);

        if (!result.success) {
            setError(result.error || "Failed to add member");
        } else {
            setSuccess(true);
            setEmail("");
            router.refresh();
        }

        setIsLoading(false);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
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
            {success && (
                <p className="text-sm text-green-600 dark:text-green-400">
                    Member added successfully!
                </p>
            )}
        </form>
    );
}

