"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Clock, Check, X, ArrowRight, Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { groupsService } from "@/services/groups";
import { log } from "@/lib/console-logger";

interface PendingSettlement {
    id: string;
    group_id: string;
    group_name: string;
    from_user_id: string;
    from_user_name: string;
    amount: number;
    requested_at: string;
}

interface PendingSettlementsProps {
    userId: string;
}

export function PendingSettlements({ userId }: PendingSettlementsProps) {
    const [settlements, setSettlements] = useState<PendingSettlement[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const { success, error: showError } = useToast();
    const router = useRouter();

    useEffect(() => {
        loadPendingSettlements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    const loadPendingSettlements = async () => {
        setIsLoading(true);
        const data = await groupsService.getPendingSettlements(userId);
        setSettlements(data);
        setIsLoading(false);
    };

    const handleApprove = async (settlement: PendingSettlement) => {
        setProcessingId(settlement.id);
        try {
            const result = await groupsService.approveSettlement(settlement.id);
            if (result.success) {
                success(
                    `Confirmed payment of $${settlement.amount.toFixed(2)} from ${settlement.from_user_name}`,
                    "Payment Confirmed"
                );
                setSettlements((prev) => prev.filter((s) => s.id !== settlement.id));
                router.refresh();
            } else {
                showError(result.error || "Failed to approve settlement");
            }
        } catch (err) {
            log.error("Settlement", "Failed to approve", err);
            showError("An unexpected error occurred");
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (settlement: PendingSettlement) => {
        setProcessingId(settlement.id);
        try {
            const result = await groupsService.rejectSettlement(settlement.id);
            if (result.success) {
                success(
                    `Rejected payment from ${settlement.from_user_name}`,
                    "Payment Rejected"
                );
                setSettlements((prev) => prev.filter((s) => s.id !== settlement.id));
                router.refresh();
            } else {
                showError(result.error || "Failed to reject settlement");
            }
        } catch (err) {
            log.error("Settlement", "Failed to reject", err);
            showError("An unexpected error occurred");
        } finally {
            setProcessingId(null);
        }
    };

    if (isLoading) {
        return (
            <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
                <CardContent className="flex items-center justify-center py-6">
                    <Spinner size="md" />
                </CardContent>
            </Card>
        );
    }

    if (settlements.length === 0) {
        return null; // Don't show card if no pending settlements
    }

    return (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-amber-800 dark:text-amber-200">
                    <Bell className="h-4 w-4" />
                    Pending Approvals
                    <Badge variant="warning" className="ml-auto">
                        {settlements.length}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {settlements.map((settlement) => {
                    const isProcessing = processingId === settlement.id;
                    const date = new Date(settlement.requested_at);
                    const formattedDate = date.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                    });

                    return (
                        <div
                            key={settlement.id}
                            className="rounded-lg border border-amber-200 bg-white p-3 dark:border-amber-700 dark:bg-gray-900"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 text-sm">
                                        <span className="font-medium text-gray-900 dark:text-white truncate">
                                            {settlement.from_user_name}
                                        </span>
                                        <ArrowRight className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                        <span className="font-medium text-teal-600 dark:text-teal-400">
                                            You
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                        {settlement.group_name} • {formattedDate}
                                    </p>
                                </div>
                                <span className="text-sm font-bold text-gray-900 dark:text-white whitespace-nowrap">
                                    ${settlement.amount.toFixed(2)}
                                </span>
                            </div>
                            
                            <div className="flex gap-2 mt-3">
                                <Button
                                    size="sm"
                                    variant="primary"
                                    className="flex-1"
                                    isLoading={isProcessing}
                                    onClick={() => handleApprove(settlement)}
                                >
                                    <Check className="mr-1 h-3 w-3" />
                                    Confirm
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1"
                                    disabled={isProcessing}
                                    onClick={() => handleReject(settlement)}
                                >
                                    <X className="mr-1 h-3 w-3" />
                                    Reject
                                </Button>
                            </div>
                        </div>
                    );
                })}
                
                <p className="text-xs text-amber-700 dark:text-amber-300 text-center pt-1">
                    💡 Confirm when you&apos;ve received the payment
                </p>
            </CardContent>
        </Card>
    );
}

