"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MessageSquarePlus, Bug, Lightbulb, Sparkles, HelpCircle, Send, CheckCircle, History, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { Link } from "@/components/ui/link";
import { cn } from "@/lib/utils";

const feedbackSchema = z.object({
    type: z.enum(["suggestion", "feature_request", "bug_report", "review", "other"]),
    title: z.string().min(5, "Title must be at least 5 characters").max(200, "Title too long"),
    description: z.string().min(20, "Please provide more details (at least 20 characters)").max(5000, "Description too long"),
    priority: z.enum(["low", "medium", "high", "critical"]).optional(),
    rating: z.number().min(1).max(5).optional(),
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    name: z.string().max(100, "Name too long").optional(),
});

type FeedbackFormData = z.infer<typeof feedbackSchema>;

interface FeedbackFormProps {
    user?: {
        id: string;
        email: string;
        full_name?: string | null;
    } | null;
}

const feedbackTypes = [
    { value: "suggestion", label: "💡 Suggestion", icon: Lightbulb, color: "text-yellow-500" },
    { value: "feature_request", label: "✨ Feature Request", icon: Sparkles, color: "text-purple-500" },
    { value: "bug_report", label: "🐛 Bug Report", icon: Bug, color: "text-red-500" },
    { value: "review", label: "⭐ Review", icon: Star, color: "text-amber-500" },
    { value: "other", label: "❓ Other", icon: HelpCircle, color: "text-gray-500" },
];

const priorityOptions = [
    { value: "low", label: "Low - Minor issue" },
    { value: "medium", label: "Medium - Affects usability" },
    { value: "high", label: "High - Major problem" },
    { value: "critical", label: "Critical - App unusable" },
];

export function FeedbackForm({ user }: FeedbackFormProps) {
    const toast = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [selectedType, setSelectedType] = useState<string>("suggestion");
    const [rating, setRating] = useState(5);
    const [hoverRating, setHoverRating] = useState(0);

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        reset,
        formState: { errors },
    } = useForm<FeedbackFormData>({
        resolver: zodResolver(feedbackSchema),
        defaultValues: {
            type: "suggestion",
            title: "",
            description: "",
            priority: "medium",
            rating: 5,
            email: user?.email || "",
            name: user?.full_name || "",
        },
    });

    const watchType = watch("type");

    useEffect(() => {
        setSelectedType(watchType);
    }, [watchType]);

    const onSubmit = async (data: FeedbackFormData) => {
        setIsSubmitting(true);

        try {
            const response = await fetch("/api/feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...data,
                    rating: data.type === "review" ? rating : undefined,
                    user_id: user?.id || null,
                    user_agent: navigator.userAgent,
                    page_url: window.location.href,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Failed to submit feedback");
            }

            setIsSubmitted(true);
            toast.success("Thank you! Your feedback has been submitted.");
            reset();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to submit feedback");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSubmitted) {
        return (
            <Card className="max-w-2xl mx-auto">
                <CardContent className="flex flex-col items-center py-16">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                        <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
                    </div>
                    <h2 className="mt-6 text-2xl font-bold text-gray-900 dark:text-white">
                        Thank You! 🎉
                    </h2>
                    <p className="mt-2 text-center text-gray-500 dark:text-gray-400 max-w-md">
                        Your feedback has been submitted successfully. We appreciate you taking the time to help us improve Smart Split!
                    </p>
                    <Button
                        className="mt-8"
                        onClick={() => setIsSubmitted(false)}
                    >
                        Submit Another Feedback
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="max-w-2xl mx-auto">
            <CardHeader className="space-y-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                    <MessageSquarePlus className="h-6 w-6 text-teal-500" />
                    Share Your Feedback
                </CardTitle>
                <CardDescription>
                    Help us improve Smart Split! Report bugs, suggest features, or share your ideas.
                </CardDescription>
                    </div>
                    {user && (
                        <Link href="/feedback/history" className="self-start">
                            <Button variant="outline" size="sm">
                                <History className="mr-2 h-4 w-4" />
                                My Submissions
                            </Button>
                        </Link>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    {/* Feedback Type Selection */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            What type of feedback?
                        </label>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {feedbackTypes.map((type) => {
                                const Icon = type.icon;
                                const isSelected = selectedType === type.value;
                                return (
                                    <button
                                        key={type.value}
                                        type="button"
                                        onClick={() => setValue("type", type.value as FeedbackFormData["type"])}
                                        className={cn(
                                            "flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all",
                                            isSelected
                                                ? "border-teal-500 bg-teal-50 dark:bg-teal-900/20"
                                                : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
                                        )}
                                    >
                                        <Icon className={cn("h-6 w-6", type.color)} />
                                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                            {type.label.split(" ")[1]}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        <input type="hidden" {...register("type")} />
                    </div>

                    {/* Title */}
                    <Input
                        label="Title *"
                        placeholder={
                            selectedType === "bug_report"
                                ? "e.g., App crashes when adding expense"
                                : selectedType === "feature_request"
                                    ? "e.g., Add dark mode support"
                                    : "Brief summary of your feedback"
                        }
                        {...register("title")}
                        error={errors.title?.message}
                    />

                    {/* Description */}
                    <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Description *
                        </label>
                        <Textarea
                            placeholder={
                                selectedType === "bug_report"
                                    ? "Please describe:\n• What happened?\n• What did you expect?\n• Steps to reproduce the issue"
                                    : selectedType === "feature_request"
                                        ? "Please describe:\n• What feature would you like?\n• How would it help you?\n• Any specific details?"
                                        : "Please provide as much detail as possible..."
                            }
                            rows={6}
                            {...register("description")}
                            className={errors.description ? "border-red-500" : ""}
                        />
                        {errors.description && (
                            <p className="text-sm text-red-500">{errors.description.message}</p>
                        )}
                    </div>

                    {/* Priority (only for bug reports) */}
                    {selectedType === "bug_report" && (
                        <Select
                            label="Priority"
                            options={priorityOptions}
                            value={watch("priority") || "medium"}
                            onChange={(value) => setValue("priority", value as FeedbackFormData["priority"])}
                        />
                    )}

                    {/* Star Rating (only for reviews) */}
                    {selectedType === "review" && (
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Your Rating *
                            </label>
                            <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => setRating(star)}
                                        onMouseEnter={() => setHoverRating(star)}
                                        onMouseLeave={() => setHoverRating(0)}
                                        className="p-1 transition-transform hover:scale-110"
                                    >
                                        <Star
                                            className={cn(
                                                "h-8 w-8 transition-colors",
                                                (hoverRating || rating) >= star
                                                    ? "fill-amber-400 text-amber-400"
                                                    : "fill-gray-200 text-gray-200 dark:fill-gray-700 dark:text-gray-700"
                                            )}
                                        />
                                    </button>
                                ))}
                                <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">
                                    {rating === 5 && "Excellent!"}
                                    {rating === 4 && "Great!"}
                                    {rating === 3 && "Good"}
                                    {rating === 2 && "Fair"}
                                    {rating === 1 && "Poor"}
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Reviews with 4+ stars may be featured on our website
                            </p>
                        </div>
                    )}

                    {/* Contact Info */}
                    <div className="space-y-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {user ? "Your contact info (pre-filled from your account)" : "Contact info (optional, but helps us follow up)"}
                        </p>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Input
                                label="Email"
                                type="email"
                                placeholder="your@email.com"
                                {...register("email")}
                                error={errors.email?.message}
                                disabled={!!user?.email}
                            />
                            <Input
                                label="Name"
                                placeholder="Your name"
                                {...register("name")}
                                error={errors.name?.message}
                            />
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-end">
                        <Button
                            type="submit"
                            isLoading={isSubmitting}
                            disabled={isSubmitting}
                            className="min-w-[150px]"
                        >
                            <Send className="mr-2 h-4 w-4" />
                            Submit Feedback
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}

