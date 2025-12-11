"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { groupsService } from "@/services/groups";

const groupSchema = z.object({
    name: z.string().min(1, "Group name is required").max(100, "Name too long"),
    description: z.string().max(500, "Description too long").optional(),
    category: z.string().optional(),
    simplify_debts: z.boolean().optional(),
});

type GroupFormData = z.infer<typeof groupSchema>;

interface GroupFormProps {
    userId: string;
    initialData?: {
        id: string;
        name: string;
        description?: string | null;
        category?: string | null;
        simplify_debts?: boolean | null;
    };
    mode?: "create" | "edit";
}

const categoryOptions = [
    { value: "trip", label: "✈️ Trip" },
    { value: "home", label: "🏠 Home" },
    { value: "couple", label: "❤️ Couple" },
    { value: "other", label: "📋 Other" },
];

export function GroupForm({ userId, initialData, mode = "create" }: GroupFormProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors },
    } = useForm<GroupFormData>({
        resolver: zodResolver(groupSchema),
        defaultValues: {
            name: initialData?.name || "",
            description: initialData?.description || "",
            category: initialData?.category || "other",
            simplify_debts: initialData?.simplify_debts ?? true,
        },
    });

    const currentCategory = watch("category");

    const onSubmit = async (data: GroupFormData) => {
        setIsLoading(true);
        setError(null);

        try {
            if (mode === "create") {
                const result = await groupsService.createGroup(userId, {
                    name: data.name,
                    description: data.description,
                    category: data.category,
                    simplify_debts: data.simplify_debts,
                });

                if (result.error) {
                    setError(result.error);
                    return;
                }

                router.push(`/groups/${result.group?.id}`);
            } else if (initialData?.id) {
                const result = await groupsService.updateGroup(initialData.id, {
                    name: data.name,
                    description: data.description,
                    category: data.category,
                    simplify_debts: data.simplify_debts,
                });

                if (!result.success) {
                    setError(result.error || "Failed to update group");
                    return;
                }

                router.push(`/groups/${initialData.id}`);
                router.refresh();
            }
        } catch (err) {
            setError("An unexpected error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{mode === "create" ? "Create New Group" : "Edit Group"}</CardTitle>
                <CardDescription>
                    {mode === "create"
                        ? "Start splitting expenses with friends, roommates, or anyone."
                        : "Update your group details."}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    {error && (
                        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                            {error}
                        </div>
                    )}

                    <Input
                        label="Group Name"
                        placeholder="e.g., Beach Trip 2025"
                        error={errors.name?.message}
                        {...register("name")}
                    />

                    <Textarea
                        label="Description (optional)"
                        placeholder="What's this group for?"
                        error={errors.description?.message}
                        {...register("description")}
                    />

                    <Select
                        label="Category"
                        options={categoryOptions}
                        value={currentCategory}
                        onChange={(value) => setValue("category", value)}
                        error={errors.category?.message}
                    />

                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="simplify_debts"
                            className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                            {...register("simplify_debts")}
                        />
                        <label htmlFor="simplify_debts" className="text-sm text-gray-700 dark:text-gray-300">
                            Simplify debts (minimize number of payments)
                        </label>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => router.back()}
                            disabled={isLoading}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" isLoading={isLoading}>
                            {mode === "create" ? "Create Group" : "Save Changes"}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}

