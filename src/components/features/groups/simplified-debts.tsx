"use client";

import { useState, useMemo, useOptimistic, useTransition, useEffect } from "react";
import { ArrowRight, Sparkles, CheckCircle2, List, Smartphone, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { simplifyDebts, type Balance, type SimplifiedPayment } from "@/lib/simplify-debts";
import { groupsService } from "@/services/groups";
import { formatCurrency } from "@/lib/currency";
import { openUpiPayment, generateUpiUrl, isValidUpiId } from "@/lib/upi";

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
    onSettle?: (fromUserId: string, toUserId: string) => void;
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
    const [isSimplified, setIsSimplified] = useState(true);
    const { success, error: showError, info } = useToast();
    
    // Optimistic UI: Track settled payments with immediate UI update
    const [isPending, startTransition] = useTransition();
    const [settledPayments, setOptimisticSettled] = useOptimistic(
        new Set<string>(),
        (current: Set<string>, paymentKey: string) => new Set([...current, paymentKey])
    );
    const [pendingPaymentKey, setPendingPaymentKey] = useState<string | null>(null);
    
    // UPI IDs for payees (userId -> upiId)
    const [payeeUpiIds, setPayeeUpiIds] = useState<Record<string, string | null>>({});
    const [currentUserHasUpi, setCurrentUserHasUpi] = useState<boolean | null>(null);
    const [isMobile, setIsMobile] = useState(false);

    const payments = useMemo(() => {
        if (isSimplified) {
            return simplifyDebts(balances);
        }
        return getRawDebtsFromExpenses(expenses, balances);
    }, [balances, expenses, isSimplified]);

    // Check if we're on mobile
    useEffect(() => {
        setIsMobile(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
    }, []);

    // Check if current user has UPI ID set (for showing tip)
    useEffect(() => {
        const checkCurrentUserUpi = async () => {
            try {
                const response = await fetch(`/api/upi/${currentUserId}`);
                if (response.ok) {
                    const data = await response.json();
                    setCurrentUserHasUpi(!!data.upi_id);
                } else {
                    setCurrentUserHasUpi(false);
                }
            } catch {
                setCurrentUserHasUpi(false);
            }
        };
        checkCurrentUserUpi();
    }, [currentUserId]);

    // Fetch UPI IDs for all payees (people receiving money)
    // Uses server API to decrypt encrypted UPI IDs
    useEffect(() => {
        const fetchUpiIds = async () => {
            const payeeIds = payments
                .filter(p => p.from_user_id === currentUserId && !p.to_is_placeholder)
                .map(p => p.to_user_id);
            
            const uniquePayeeIds = [...new Set(payeeIds)];
            
            const upiIdMap: Record<string, string | null> = {};
            for (const payeeId of uniquePayeeIds) {
                try {
                    // Fetch decrypted UPI ID from server API
                    const response = await fetch(`/api/upi/${payeeId}`);
                    if (response.ok) {
                        const data = await response.json();
                        upiIdMap[payeeId] = data.upi_id;
                    } else {
                        upiIdMap[payeeId] = null;
                    }
                } catch {
                    upiIdMap[payeeId] = null;
                }
            }
            
            setPayeeUpiIds(upiIdMap);
        };

        if (payments.length > 0) {
            fetchUpiIds();
        }
    }, [payments, currentUserId]);

    // Handle UPI payment
    const handleUpiPayment = (payment: SimplifiedPayment) => {
        const upiId = payeeUpiIds[payment.to_user_id];
        
        if (!upiId || !isValidUpiId(upiId)) {
            showError(`${payment.to_user_name} hasn't set up their UPI ID yet`);
            return;
        }

        const upiParams = {
            upiId: upiId,
            payeeName: payment.to_user_name,
            amount: payment.amount,
            currency: "INR", // UPI only works with INR
            note: `Smart Split: Settlement to ${payment.to_user_name}`,
        };

        if (isMobile) {
            // On mobile, open UPI app
            const opened = openUpiPayment(upiParams);
            if (opened) {
                info(`Opening payment app to pay ${payment.to_user_name}`, "UPI Payment");
            } else {
                showError("Could not open UPI app. Please ensure you have a UPI app installed.");
            }
        } else {
            // On desktop, show the UPI ID and copy to clipboard
            const upiUrl = generateUpiUrl(upiParams);
            navigator.clipboard.writeText(upiId);
            info(
                `UPI ID "${upiId}" copied! Open any UPI app on your phone and pay ₹${payment.amount.toFixed(2)} to ${payment.to_user_name}`,
                "Pay via UPI"
            );
        }
    };

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

    const handleSettle = (payment: SimplifiedPayment) => {
        const paymentKey = `${payment.from_user_id}-${payment.to_user_id}`;
        setPendingPaymentKey(paymentKey);

        // Use transition for optimistic update
        startTransition(async () => {
            // Immediately show settled state (optimistic)
            setOptimisticSettled(paymentKey);

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
                    if (result.pending) {
                        success(
                            `Settlement request of ${formatCurrency(payment.amount, currency)} sent to ${payment.to_user_name} for approval`,
                            "Awaiting Approval"
                        );
                    } else {
                        success(`Settlement of ${formatCurrency(payment.amount, currency)} recorded!`, "Payment Settled");
                    }
                    // Pass user IDs for cache invalidation
                    onSettle?.(payment.from_user_id, payment.to_user_id);
                } else {
                    // On failure, the optimistic state will revert automatically
                    // because we're in a transition
                    showError(result.error || "Failed to record settlement");
                }
            } catch (error) {
                console.error("Failed to settle:", error);
                showError("An unexpected error occurred");
            } finally {
                setPendingPaymentKey(null);
            }
        });
    };
    
    // Track if a specific payment is being settled (for loading state)
    const isSettling = (paymentKey: string) => isPending && pendingPaymentKey === paymentKey;

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
                            const settlingThis = isSettling(paymentKey);
                            const youOwe = payment.from_user_id === currentUserId;

                            return (
                                <div
                                    key={paymentKey}
                                    className={`flex items-center justify-between rounded-lg border p-3 transition-all duration-200 ${isSettled
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
                                            <Badge variant="success" className="animate-in fade-in duration-300">
                                                ✓ Settled
                                            </Badge>
                                        ) : youOwe ? (
                                            <div className="flex items-center gap-2">
                                                {/* UPI Payment Button - only show if payee has UPI ID */}
                                                {!payment.to_is_placeholder && payeeUpiIds[payment.to_user_id] && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleUpiPayment(payment)}
                                                        className="bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-400 dark:hover:bg-purple-900/40"
                                                        title="Pay via UPI"
                                                    >
                                                        {isMobile ? (
                                                            <>
                                                                <Smartphone className="mr-1.5 h-3.5 w-3.5" />
                                                                Pay UPI
                                                            </>
                                                        ) : (
                                                            <>
                                                                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                                                                UPI
                                                            </>
                                                        )}
                                                    </Button>
                                                )}
                                                <Button
                                                    size="sm"
                                                    variant="primary"
                                                    isLoading={settlingThis}
                                                    onClick={() => handleSettle(payment)}
                                                >
                                                    Settle
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                isLoading={settlingThis}
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
                {currentUserHasUpi === false && (
                    <p className="text-xs text-purple-600 dark:text-purple-400 text-center">
                        💳 Tip: Add your UPI ID in Settings → Profile to receive payments directly
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
