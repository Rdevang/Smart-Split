"use client";

import { useState } from "react";
import { MessageSquare, Bug, Lightbulb, Sparkles, HelpCircle, ChevronDown, ChevronUp, Clock, CheckCircle, XCircle, Eye, Archive } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Link } from "@/components/ui/link";
import { Button } from "@/components/ui/button";

// Format date in a consistent way to avoid hydration mismatch
function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

function formatDateTime(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

interface Feedback {
    id: string;
    type: "suggestion" | "feature_request" | "bug_report" | "other";
    title: string;
    description: string;
    priority: "low" | "medium" | "high" | "critical" | null;
    status: string;
    admin_response: string | null;
    created_at: string;
    updated_at: string;
}

interface FeedbackHistoryProps {
    feedbacks: Feedback[];
}

const typeConfig = {
    suggestion: { label: "Suggestion", icon: Lightbulb, color: "text-yellow-500", bg: "bg-yellow-50 dark:bg-yellow-900/20" },
    feature_request: { label: "Feature Request", icon: Sparkles, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-900/20" },
    bug_report: { label: "Bug Report", icon: Bug, color: "text-red-500", bg: "bg-red-50 dark:bg-red-900/20" },
    other: { label: "Other", icon: HelpCircle, color: "text-gray-500", bg: "bg-gray-50 dark:bg-gray-800" },
};

const statusConfig: Record<string, { label: string; icon: typeof Clock; variant: "default" | "primary" | "success" | "danger" | "warning" | "info" }> = {
    submitted: { label: "Submitted", icon: Clock, variant: "info" },
    new: { label: "Submitted", icon: Clock, variant: "info" },
    under_review: { label: "Under Review", icon: Eye, variant: "warning" },
    reviewing: { label: "Under Review", icon: Eye, variant: "warning" },
    approved: { label: "Approved", icon: CheckCircle, variant: "success" },
    completed: { label: "Approved", icon: CheckCircle, variant: "success" },
    planned: { label: "Planned", icon: CheckCircle, variant: "primary" },
    in_progress: { label: "In Progress", icon: Clock, variant: "warning" },
    rejected: { label: "Rejected", icon: XCircle, variant: "danger" },
    declined: { label: "Rejected", icon: XCircle, variant: "danger" },
    closed: { label: "Closed", icon: Archive, variant: "default" },
};

const priorityConfig = {
    low: { label: "Low", variant: "default" as const },
    medium: { label: "Medium", variant: "warning" as const },
    high: { label: "High", variant: "danger" as const },
    critical: { label: "Critical", variant: "danger" as const },
};

function FeedbackCard({ feedback }: { feedback: Feedback }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const type = typeConfig[feedback.type] || typeConfig.other;
    const status = statusConfig[feedback.status] || statusConfig.submitted;
    const TypeIcon = type.icon;
    const StatusIcon = status.icon;

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
                            <h3 className="font-medium text-gray-900 dark:text-white truncate">
                                {feedback.title}
                            </h3>
                            <div className="flex items-center gap-2 shrink-0">
                                <Badge variant={status.variant} className="flex items-center gap-1">
                                    <StatusIcon className="h-3 w-3" />
                                    {status.label}
                                </Badge>
                                {isExpanded ? (
                                    <ChevronUp className="h-4 w-4 text-gray-400" />
                                ) : (
                                    <ChevronDown className="h-4 w-4 text-gray-400" />
                                )}
                            </div>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                            <span>{type.label}</span>
                            {feedback.priority && (
                                <>
                                    <span>•</span>
                                    <Badge variant={priorityConfig[feedback.priority]?.variant || "default"}>
                                        {priorityConfig[feedback.priority]?.label || feedback.priority}
                                    </Badge>
                                </>
                            )}
                            <span>•</span>
                            <span suppressHydrationWarning>{formatDate(feedback.created_at)}</span>
                        </div>
                    </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                    <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-4 space-y-4">
                        {/* Description */}
                        <div>
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Description
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                                {feedback.description}
                            </p>
                        </div>

                        {/* Admin Response */}
                        {feedback.admin_response && (
                            <div className="rounded-lg bg-teal-50 dark:bg-teal-900/20 p-3 border border-teal-200 dark:border-teal-800">
                                <h4 className="text-sm font-medium text-teal-800 dark:text-teal-300 mb-1 flex items-center gap-1">
                                    <MessageSquare className="h-4 w-4" />
                                    Response from Team
                                </h4>
                                <p className="text-sm text-teal-700 dark:text-teal-400 whitespace-pre-wrap">
                                    {feedback.admin_response}
                                </p>
                            </div>
                        )}

                        {/* Timestamps */}
                        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
                            <span suppressHydrationWarning>Submitted: {formatDateTime(feedback.created_at)}</span>
                            {feedback.updated_at !== feedback.created_at && (
                                <span suppressHydrationWarning>Updated: {formatDateTime(feedback.updated_at)}</span>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export function FeedbackHistory({ feedbacks }: FeedbackHistoryProps) {
    if (feedbacks.length === 0) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                        <MessageSquare className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                        No feedback yet
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 text-center max-w-sm">
                        You haven&apos;t submitted any feedback yet. Help us improve Smart Split by sharing your thoughts!
                    </p>
                    <Link href="/feedback">
                        <Button className="mt-6">
                            Submit Feedback
                        </Button>
                    </Link>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* Stats Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {feedbacks.length}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-yellow-600">
                            {feedbacks.filter(f => ["submitted", "new", "under_review", "reviewing"].includes(f.status)).length}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Pending</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-green-600">
                            {feedbacks.filter(f => ["approved", "completed", "planned", "in_progress"].includes(f.status)).length}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Approved</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-gray-600">
                            {feedbacks.filter(f => ["rejected", "declined", "closed"].includes(f.status)).length}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Closed</p>
                    </CardContent>
                </Card>
            </div>

            {/* Submit New Button */}
            <div className="flex justify-end">
                <Link href="/feedback">
                    <Button variant="outline">
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Submit New Feedback
                    </Button>
                </Link>
            </div>

            {/* Feedback List */}
            <div className="space-y-3">
                {feedbacks.map((feedback) => (
                    <FeedbackCard key={feedback.id} feedback={feedback} />
                ))}
            </div>
        </div>
    );
}

