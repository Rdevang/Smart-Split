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
import { useToast } from "@/components/ui/toast";
import { groupsService } from "@/services/groups";
import { onGroupMutation } from "@/app/(dashboard)/actions";

const groupSchema = z.object({
    name: z.string().min(1, "Group name is required").max(100, "Name too long"),
    description: z.string().max(500, "Description too long").optional(),
    category: z.string().optional(),
    currency: z.string().min(1, "Currency is required"),
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
        currency?: string | null;
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

const currencyOptions = [
    { value: "USD", label: "🇺🇸 USD - US Dollar ($)" },
    { value: "EUR", label: "🇪🇺 EUR - Euro (€)" },
    { value: "GBP", label: "🇬🇧 GBP - British Pound (£)" },
    { value: "INR", label: "🇮🇳 INR - Indian Rupee (₹)" },
    { value: "CAD", label: "🇨🇦 CAD - Canadian Dollar (C$)" },
    { value: "AUD", label: "🇦🇺 AUD - Australian Dollar (A$)" },
    { value: "JPY", label: "🇯🇵 JPY - Japanese Yen (¥)" },
    { value: "CNY", label: "🇨🇳 CNY - Chinese Yuan (¥)" },
];

export function GroupForm({ userId, initialData, mode = "create" }: GroupFormProps) {
    const router = useRouter();
    const toast = useToast();
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
            currency: initialData?.currency || "USD",
            simplify_debts: initialData?.simplify_debts ?? true,
        },
    });

    const currentCategory = watch("category");
    const currentCurrency = watch("currency");

    const onSubmit = async (data: GroupFormData) => {
        setIsLoading(true);
        setError(null);

        try {
            if (mode === "create") {
                const result = await groupsService.createGroup(userId, {
                    name: data.name,
                    description: data.description,
                    category: data.category,
                    currency: data.currency,
                    simplify_debts: data.simplify_debts,
                });

                if (result.error) {
                    setError(result.error);
                    toast.error(result.error);
                    return;
                }

                // Invalidate cache for user's groups
                if (result.group?.id) {
                    await onGroupMutation(result.group.id, userId);
                }

                toast.success(`Group "${data.name}" created!`);
                router.push(`/groups/${result.group?.id}`);
            } else if (initialData?.id) {
                const result = await groupsService.updateGroup(
                    initialData.id,
                    {
                        name: data.name,
                        description: data.description,
                        category: data.category,
                        currency: data.currency,
                        simplify_debts: data.simplify_debts,
                    },
                    userId // SECURITY: Pass userId for authorization check
                );

                if (!result.success) {
                    setError(result.error || "Failed to update group");
                    toast.error(result.error || "Failed to update group");
                    return;
                }

                // Invalidate cache for the group
                await onGroupMutation(initialData.id, userId);

                toast.success("Group updated successfully!");
                router.push(`/groups/${initialData.id}`);
                router.refresh();
            }
        } catch {
            setError("An unexpected error occurred");
            toast.error("An unexpected error occurred");
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

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Select
                            label="Category"
                            options={categoryOptions}
                            value={currentCategory}
                            onChange={(value) => setValue("category", value)}
                            error={errors.category?.message}
                        />

                        <Select
                            label="Currency"
                            options={currencyOptions}
                            value={currentCurrency}
                            onChange={(value) => setValue("currency", value)}
                            error={errors.currency?.message}
                        />
                    </div>

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
