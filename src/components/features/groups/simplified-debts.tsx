"use client";

import { useState, useMemo } from "react";
import { ArrowRight, Sparkles, CheckCircle2, List } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { simplifyDebts, type Balance, type SimplifiedPayment } from "@/lib/simplify-debts";
import { groupsService } from "@/services/groups";
import { formatCurrency } from "@/lib/currency";

interface ExpenseSplit {
    user_id: string | null;
    placeholder_id?: string | null;
    amount: number;
    profile?: { id: string; full_name: string | null } | null;
    placeholder?: { id: string; name: string } | null;
}

interface Expense {
    id: string;
    paid_by: string | null;
    paid_by_placeholder_id?: string | null;
    paid_by_profile?: { id: string; full_name: string | null } | null;
    paid_by_placeholder?: { id: string; name: string } | null;
    splits: ExpenseSplit[];
}

interface SimplifiedDebtsProps {
    groupId: string;
    balances: Balance[];
    expenses: Expense[];
    currentUserId: string;
    currency?: string;
    onSettle?: () => void;
}

/**
 * Calculate raw per-expense debts with netting between pairs.
 * Each person who owes on an expense pays the person who paid for that expense.
 * Bidirectional debts between the same two people are netted out.
 */
function getRawDebtsFromExpenses(expenses: Expense[], balances: Balance[]): SimplifiedPayment[] {
    // Track gross debts: key is "fromId-toId", value is the debt info
    const grossDebts = new Map<string, SimplifiedPayment>();

    for (const expense of expenses) {
        // Determine who paid
        const payerId = expense.paid_by || expense.paid_by_placeholder_id;
        if (!payerId) continue;

        const payerName = expense.paid_by_profile?.full_name ||
            expense.paid_by_placeholder?.name ||
            "Unknown";
        const payerIsPlaceholder = !!expense.paid_by_placeholder_id;

        // Each split participant owes the payer (except the payer themselves)
        for (const split of expense.splits) {
            const participantId = split.user_id || split.placeholder_id;
            if (!participantId || participantId === payerId) continue;

            const participantName = split.profile?.full_name ||
                split.placeholder?.name ||
                "Unknown";
            const participantIsPlaceholder = !!split.placeholder_id;

            // Create debt: participant owes payer
            const key = `${participantId}-${payerId}`;
            const existing = grossDebts.get(key);

            if (existing) {
                existing.amount += split.amount;
            } else {
                grossDebts.set(key, {
                    from_user_id: participantId,
                    from_user_name: participantName,
                    to_user_id: payerId,
                    to_user_name: payerName,
                    amount: split.amount,
                    from_is_placeholder: participantIsPlaceholder,
                    to_is_placeholder: payerIsPlaceholder,
                });
            }
        }
    }

    // Net out bidirectional debts between same pairs
    const processedPairs = new Set<string>();
    const nettedDebts: SimplifiedPayment[] = [];

    for (const [key, debt] of grossDebts) {
        // Create a canonical pair key (sorted IDs)
        const pairKey = [debt.from_user_id, debt.to_user_id].sort().join(":");
        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);

        // Check for reverse debt
        const reverseKey = `${debt.to_user_id}-${debt.from_user_id}`;
        const reverseDebt = grossDebts.get(reverseKey);

        if (reverseDebt) {
            // Net out the debts
            const netAmount = Math.round((debt.amount - reverseDebt.amount) * 100) / 100;

            if (netAmount > 0.01) {
                // Original direction wins
                nettedDebts.push({ ...debt, amount: netAmount });
            } else if (netAmount < -0.01) {
                // Reverse direction wins
                nettedDebts.push({ ...reverseDebt, amount: Math.abs(netAmount) });
            }
            // If netAmount is ~0, no debt needed
        } else {
            // No reverse debt, keep original
            const amount = Math.round(debt.amount * 100) / 100;
            if (amount > 0.01) {
                nettedDebts.push({ ...debt, amount });
            }
        }
    }

    return nettedDebts;
}

export function SimplifiedDebts({ groupId, balances, expenses, currentUserId, currency = "USD", onSettle }: SimplifiedDebtsProps) {
    const [settlingPayment, setSettlingPayment] = useState<string | null>(null);
    const [settledPayments, setSettledPayments] = useState<Set<string>>(new Set());
    const [isSimplified, setIsSimplified] = useState(true);
    const { success, error: showError } = useToast();

    const payments = useMemo(() => {
        if (isSimplified) {
            return simplifyDebts(balances);
        }
        return getRawDebtsFromExpenses(expenses, balances);
    }, [balances, expenses, isSimplified]);

    if (payments.length === 0) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center py-8">
                    <CheckCircle2 className="h-12 w-12 text-green-500" />
                    <p className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                        All settled up! 🎉
                    </p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        No outstanding balances in this group
                    </p>
                </CardContent>
            </Card>
        );
    }

    const handleSettle = async (payment: SimplifiedPayment) => {
        const paymentKey = `${payment.from_user_id}-${payment.to_user_id}`;
        setSettlingPayment(paymentKey);

        try {
            // Record the settlement with placeholder flags
            const result = await groupsService.recordSettlement(
                groupId,
                payment.from_user_id,
                payment.to_user_id,
                payment.amount,
                currentUserId,
                payment.from_is_placeholder || false,
                payment.to_is_placeholder || false
            );

            if (result.success) {
                setSettledPayments((prev) => new Set([...prev, paymentKey]));
                if (result.pending) {
                    success(
                        `Settlement request of ${formatCurrency(payment.amount, currency)} sent to ${payment.to_user_name} for approval`,
                        "Awaiting Approval"
                    );
                } else {
                    success(`Settlement of ${formatCurrency(payment.amount, currency)} recorded!`, "Payment Settled");
                }
                onSettle?.();
            } else {
                showError(result.error || "Failed to record settlement");
            }
        } catch (error) {
            console.error("Failed to settle:", error);
            showError("An unexpected error occurred");
        } finally {
            setSettlingPayment(null);
        }
    };

    // Separate payments involving current user from others
    const myPayments = payments.filter(
        (p) => p.from_user_id === currentUserId || p.to_user_id === currentUserId
    );
    const otherPayments = payments.filter(
        (p) => p.from_user_id !== currentUserId && p.to_user_id !== currentUserId
    );

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                        {isSimplified ? (
                            <Sparkles className="h-4 w-4 text-amber-500" />
                        ) : (
                            <List className="h-4 w-4 text-blue-500" />
                        )}
                        {isSimplified ? "Simplified Debts" : "Raw Debts"}
                    </CardTitle>
                    <Badge variant="info">
                        {payments.length} payment{payments.length !== 1 ? "s" : ""}
                    </Badge>
                </div>
                {/* Simplify Toggle */}
                <label className="mt-3 flex cursor-pointer items-center gap-3">
                    <div className="relative">
                        <input
                            type="checkbox"
                            checked={isSimplified}
                            onChange={(e) => setIsSimplified(e.target.checked)}
                            className="peer sr-only"
                        />
                        <div className="h-5 w-9 rounded-full bg-gray-200 transition-colors peer-checked:bg-teal-500 peer-focus:ring-2 peer-focus:ring-teal-500/20 dark:bg-gray-700" />
                        <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4 shadow-sm" />
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                        Simplify debts
                        <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">
                            (minimize payments)
                        </span>
                    </span>
                </label>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Payments involving current user */}
                {myPayments.length > 0 && (
                    <div className="space-y-3">
                        <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Your Payments
                        </p>
                        {myPayments.map((payment) => {
                            const paymentKey = `${payment.from_user_id}-${payment.to_user_id}`;
                            const isSettled = settledPayments.has(paymentKey);
                            const isSettling = settlingPayment === paymentKey;
                            const youOwe = payment.from_user_id === currentUserId;

                            return (
                                <div
                                    key={paymentKey}
                                    className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${isSettled
                                        ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                                        : youOwe
                                            ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
                                            : "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-sm font-medium ${youOwe ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400"
                                                }`}>
                                                {youOwe ? "You" : payment.from_user_name}
                                            </span>
                                            <ArrowRight className="h-4 w-4 text-gray-400" />
                                            <span className={`text-sm font-medium ${!youOwe ? "text-green-700 dark:text-green-400" : "text-gray-700 dark:text-gray-300"
                                                }`}>
                                                {youOwe ? payment.to_user_name : "You"}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                                            {formatCurrency(payment.amount, currency)}
                                        </span>
                                        {isSettled ? (
                                            <Badge variant="success">Settled</Badge>
                                        ) : youOwe ? (
                                            <Button
                                                size="sm"
                                                variant="primary"
                                                isLoading={isSettling}
                                                onClick={() => handleSettle(payment)}
                                            >
                                                Settle
                                            </Button>
                                        ) : (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                isLoading={isSettling}
                                                onClick={() => handleSettle(payment)}
                                            >
                                                Mark Paid
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Other payments */}
                {otherPayments.length > 0 && (
                    <div className="space-y-3">
                        <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Other Settlements
                        </p>
                        {otherPayments.map((payment) => {
                            const paymentKey = `${payment.from_user_id}-${payment.to_user_id}`;
                            const isSettled = settledPayments.has(paymentKey);

                            return (
                                <div
                                    key={paymentKey}
                                    className={`flex items-center justify-between rounded-lg border p-3 ${isSettled
                                        ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                                        : "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50"
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-gray-700 dark:text-gray-300">
                                                {payment.from_user_name}
                                            </span>
                                            <ArrowRight className="h-4 w-4 text-gray-400" />
                                            <span className="text-sm text-gray-700 dark:text-gray-300">
                                                {payment.to_user_name}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                                        {formatCurrency(payment.amount, currency)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}

                <p className="text-xs text-gray-500 dark:text-gray-400 text-center pt-2">
                    {isSimplified
                        ? "💡 Debts are simplified to minimize the number of payments needed"
                        : "📋 Showing per-expense debts (who owes each payer)"
                    }
                </p>
            </CardContent>
        </Card>
    );
}
