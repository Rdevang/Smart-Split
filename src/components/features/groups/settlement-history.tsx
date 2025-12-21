"use client";

import { useState, useEffect, useCallback } from "react";
import { Clock, ArrowRight, History, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { groupsService } from "@/services/groups";
import { formatCurrency } from "@/lib/currency";

interface Settlement {
    id: string;
    from_user: string;
    from_user_name: string;
    to_user: string;
    to_user_name: string;
    amount: number;
    settled_at: string;
    note: string | null;
    status?: string;
}

interface SettlementHistoryProps {
    groupId: string;
    currentUserId: string;
    initialSettlements?: Settlement[];
    refreshKey?: number; // Increment to trigger refresh
    currency?: string;
}

export function SettlementHistory({ groupId, currentUserId, initialSettlements, refreshKey = 0, currency = "USD" }: SettlementHistoryProps) {
    const [settlements, setSettlements] = useState<Settlement[]>(initialSettlements || []);
    const [isLoading, setIsLoading] = useState(!initialSettlements);
    const [isExpanded, setIsExpanded] = useState(false);

    const loadSettlements = useCallback(async () => {
        setIsLoading(true);
        const data = await groupsService.getSettlementsWithNames(groupId);
        setSettlements(data);
        setIsLoading(false);
    }, [groupId]);

    // Update settlements when initialSettlements changes (from server refresh)
    useEffect(() => {
        if (initialSettlements) {
            setSettlements(initialSettlements);
        }
    }, [initialSettlements]);

    useEffect(() => {
        if (!initialSettlements) {
            loadSettlements();
        }
    }, [groupId, initialSettlements, loadSettlements]);

    // Refresh when refreshKey changes
    useEffect(() => {
        if (refreshKey > 0) {
            loadSettlements();
        }
    }, [refreshKey, loadSettlements]);

    if (isLoading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-8">
                    <Spinner size="md" />
                </CardContent>
            </Card>
        );
    }

    if (settlements.length === 0) {
        return null; // Don't show card if no settlements
    }

    const displayedSettlements = isExpanded ? settlements : settlements.slice(0, 3);
    // All settlements in history are approved now
    const totalSettled = settlements.reduce((sum, s) => sum + s.amount, 0);

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <History className="h-4 w-4 text-teal-500" />
                        Settlement History
                    </CardTitle>
                    <Badge variant="success">
                        {formatCurrency(totalSettled, currency)} settled
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {displayedSettlements.map((settlement) => {
                    const isFromMe = settlement.from_user === currentUserId;
                    const isToMe = settlement.to_user === currentUserId;
                    const date = new Date(settlement.settled_at);
                    const formattedDate = date.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                    });
                    const formattedTime = date.toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                    });

                    return (
                        <div
                            key={settlement.id}
                            className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50"
                        >
                            <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900/30">
                                    <Clock className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-1.5 text-sm">
                                        <span className={`font-medium ${isFromMe ? "text-teal-600 dark:text-teal-400" : "text-gray-700 dark:text-gray-300"}`}>
                                            {isFromMe ? "You" : settlement.from_user_name}
                                        </span>
                                        <ArrowRight className="h-3 w-3 text-gray-400" />
                                        <span className={`font-medium ${isToMe ? "text-teal-600 dark:text-teal-400" : "text-gray-700 dark:text-gray-300"}`}>
                                            {isToMe ? "You" : settlement.to_user_name}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {formattedDate} at {formattedTime}
                                    </p>
                                </div>
                            </div>
                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                                {formatCurrency(settlement.amount, currency)}
                            </span>
                        </div>
                    );
                })}

                {settlements.length > 3 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="w-full text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                        {isExpanded ? (
                            <>
                                <ChevronUp className="mr-2 h-4 w-4" />
                                Show less
                            </>
                        ) : (
                            <>
                                <ChevronDown className="mr-2 h-4 w-4" />
                                Show {settlements.length - 3} more
                            </>
                        )}
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}
