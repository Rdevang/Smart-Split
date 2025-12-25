"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Bug, Lightbulb, Sparkles, HelpCircle, ChevronDown, ChevronUp, Send, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface Feedback {
    id: string;
    type: string;
    title: string;
    description: string;
    priority: string | null;
    status: string;
    email: string | null;
    name: string | null;
    user_id: string | null;
    admin_response: string | null;
    created_at: string;
    updated_at: string;
}

interface AdminFeedbackListProps {
    feedbacks: Feedback[];
}

const typeConfig: Record<string, { label: string; icon: typeof MessageSquare; color: string; bg: string }> = {
    suggestion: { label: "Suggestion", icon: Lightbulb, color: "text-yellow-500", bg: "bg-yellow-50 dark:bg-yellow-900/20" },
    feature_request: { label: "Feature Request", icon: Sparkles, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-900/20" },
    bug_report: { label: "Bug Report", icon: Bug, color: "text-red-500", bg: "bg-red-50 dark:bg-red-900/20" },
    other: { label: "Other", icon: HelpCircle, color: "text-gray-500", bg: "bg-gray-50 dark:bg-gray-800" },
};

const statusOptions = [
    { value: "submitted", label: "Submitted" },
    { value: "under_review", label: "Under Review" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
    { value: "closed", label: "Closed" },
];

const statusColors: Record<string, string> = {
    submitted: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    new: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    under_review: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    reviewing: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    declined: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    closed: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
};

function FeedbackCard({ feedback, onUpdate }: { feedback: Feedback; onUpdate: () => void }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [status, setStatus] = useState(feedback.status);
    const [response, setResponse] = useState(feedback.admin_response || "");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const toast = useToast();

    const type = typeConfig[feedback.type] || typeConfig.other;
    const TypeIcon = type.icon;

    const handleSave = async () => {
        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/admin/feedback/${feedback.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status, admin_response: response }),
            });

            if (!res.ok) {
                throw new Error("Failed to update feedback");
            }

            toast.success("Feedback updated successfully");
            onUpdate();
        } catch (error) {
            toast.error("Failed to update feedback");
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    };

    return (
        <Card className="overflow-hidden">
            <CardContent className="p-0">
                {/* Header - Always visible */}
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex w-full items-start gap-4 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                    {/* Type Icon */}
                    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", type.bg)}>
                        <TypeIcon className={cn("h-5 w-5", type.color)} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                            <h3 className="font-medium text-gray-900 dark:text-white">
                                {feedback.title}
                            </h3>
                            <div className="flex items-center gap-2 shrink-0">
                                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", statusColors[feedback.status] || statusColors.submitted)}>
                                    {feedback.status.replace("_", " ")}
                                </span>
                                {isExpanded ? (
                                    <ChevronUp className="h-4 w-4 text-gray-400" />
                                ) : (
                                    <ChevronDown className="h-4 w-4 text-gray-400" />
                                )}
                            </div>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <span>{type.label}</span>
                            <span>•</span>
                            <span>{feedback.name || feedback.email || "Anonymous"}</span>
                            <span>•</span>
                            <span suppressHydrationWarning>{formatDate(feedback.created_at)}</span>
                        </div>
                    </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                    <div className="border-t border-gray-200 dark:border-gray-700 p-5 space-y-5">
                        {/* Description */}
                        <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                                Description
                            </h4>
                            <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                                {feedback.description}
                            </div>
                        </div>

                        {/* User Info & Priority */}
                        <div className="flex flex-wrap gap-6">
                            {(feedback.name || feedback.email) && (
                                <div>
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                                        Contact
                                    </h4>
                                    <div className="text-sm text-gray-700 dark:text-gray-300">
                                        {feedback.name && <p className="font-medium">{feedback.name}</p>}
                                        {feedback.email && (
                                            <a href={`mailto:${feedback.email}`} className="text-teal-600 hover:underline dark:text-teal-400">
                                                {feedback.email}
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}
                            {feedback.priority && (
                                <div>
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                                        Priority
                                    </h4>
                                    <span className={cn(
                                        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                                        feedback.priority === "critical" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                                        feedback.priority === "high" && "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
                                        feedback.priority === "medium" && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
                                        feedback.priority === "low" && "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                                    )}>
                                        {feedback.priority}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Admin Actions */}
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-5 space-y-4">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                Admin Actions
                            </h4>

                            <div className="grid gap-4 sm:grid-cols-2">
                                {/* Status */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Update Status
                                    </label>
                                    <Select
                                        options={statusOptions}
                                        value={status}
                                        onChange={setStatus}
                                    />
                                </div>
                            </div>

                            {/* Response */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Response to User
                                </label>
                                <Textarea
                                    value={response}
                                    onChange={(e) => setResponse(e.target.value)}
                                    placeholder="Write a response that will be visible to the user..."
                                    rows={3}
                                    className="resize-none"
                                />
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    The user will receive a notification when you respond.
                                </p>
                            </div>

                            {/* Save Button */}
                            <div className="flex justify-end pt-2">
                                <Button onClick={handleSave} disabled={isSubmitting}>
                                    {isSubmitting ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Send className="mr-2 h-4 w-4" />
                                    )}
                                    Save Changes
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export function AdminFeedbackList({ feedbacks }: AdminFeedbackListProps) {
    const router = useRouter();
    const [filter, setFilter] = useState<string>("all");

    const filteredFeedbacks = (feedbacks || []).filter((f) => {
        if (filter === "all") return true;
        if (filter === "pending") return ["submitted", "new", "under_review", "reviewing"].includes(f.status);
        if (filter === "resolved") return ["approved", "completed", "rejected", "declined", "closed"].includes(f.status);
        return f.status === filter;
    });

    // Stats
    const safeFeedbacks = feedbacks || [];
    const stats = {
        total: safeFeedbacks.length,
        pending: safeFeedbacks.filter(f => ["submitted", "new", "under_review", "reviewing"].includes(f.status)).length,
        approved: safeFeedbacks.filter(f => ["approved", "completed"].includes(f.status)).length,
        rejected: safeFeedbacks.filter(f => ["rejected", "declined"].includes(f.status)).length,
    };

    return (
        <div className="space-y-6">
            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-4">
                <Card className="cursor-pointer hover:shadow-md" onClick={() => setFilter("all")}>
                    <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
                    </CardContent>
                </Card>
                <Card className="cursor-pointer hover:shadow-md" onClick={() => setFilter("pending")}>
                    <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Pending</p>
                    </CardContent>
                </Card>
                <Card className="cursor-pointer hover:shadow-md" onClick={() => setFilter("approved")}>
                    <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Approved</p>
                    </CardContent>
                </Card>
                <Card className="cursor-pointer hover:shadow-md" onClick={() => setFilter("rejected")}>
                    <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Rejected</p>
                    </CardContent>
                </Card>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap gap-2">
                {[
                    { value: "all", label: "All" },
                    { value: "pending", label: "Pending" },
                    { value: "submitted", label: "Submitted" },
                    { value: "under_review", label: "Under Review" },
                    { value: "approved", label: "Approved" },
                    { value: "rejected", label: "Rejected" },
                    { value: "closed", label: "Closed" },
                ].map((option) => (
                    <button
                        key={option.value}
                        onClick={() => setFilter(option.value)}
                        className={cn(
                            "rounded-full px-3 py-1 text-sm font-medium transition-colors",
                            filter === option.value
                                ? "bg-teal-500 text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                        )}
                    >
                        {option.label}
                    </button>
                ))}
            </div>

            {/* Feedback List */}
            <div className="space-y-4">
                {filteredFeedbacks.length > 0 ? (
                    filteredFeedbacks.map((feedback) => (
                        <FeedbackCard 
                            key={feedback.id} 
                            feedback={feedback} 
                            onUpdate={() => router.refresh()}
                        />
                    ))
                ) : (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
                            <p className="mt-4 text-gray-500 dark:text-gray-400">
                                No feedback found
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}

