"use client";

import { useState, useMemo } from "react";
import { ArrowRight, Sparkles, CheckCircle2, List } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { simplifyDebts, type Balance, type SimplifiedPayment } from "@/lib/simplify-debts";
import { groupsService } from "@/services/groups";

interface SimplifiedDebtsProps {
    groupId: string;
    balances: Balance[];
    currentUserId: string;
    onSettle?: () => void;
}

/**
 * Generates raw/unsimplified debts where each debtor pays each creditor proportionally.
 * This results in more payments but shows direct relationships.
 */
function getRawDebts(balances: Balance[]): SimplifiedPayment[] {
    const payments: SimplifiedPayment[] = [];

    // Separate into creditors and debtors
    const creditors: Balance[] = [];
    const debtors: Balance[] = [];

    for (const balance of balances) {
        const amount = Math.round(balance.balance * 100) / 100;
        if (amount > 0.01) {
            creditors.push({ ...balance, balance: amount });
        } else if (amount < -0.01) {
            debtors.push({ ...balance, balance: Math.abs(amount) });
        }
    }

    // Calculate total credit and total debt
    const totalCredit = creditors.reduce((sum, c) => sum + c.balance, 0);

    // Each debtor pays each creditor proportionally
    for (const debtor of debtors) {
        for (const creditor of creditors) {
            // Debtor's share to this creditor = debtor's debt * (creditor's credit / total credit)
            const amount = Math.round((debtor.balance * (creditor.balance / totalCredit)) * 100) / 100;

            if (amount > 0.01) {
                payments.push({
                    from_user_id: debtor.user_id,
                    from_user_name: debtor.user_name,
                    to_user_id: creditor.user_id,
                    to_user_name: creditor.user_name,
                    amount,
                    from_is_placeholder: debtor.is_placeholder,
                    to_is_placeholder: creditor.is_placeholder,
                });
            }
        }
    }

    return payments;
}

export function SimplifiedDebts({ groupId, balances, currentUserId, onSettle }: SimplifiedDebtsProps) {
    const [settlingPayment, setSettlingPayment] = useState<string | null>(null);
    const [settledPayments, setSettledPayments] = useState<Set<string>>(new Set());
    const [isSimplified, setIsSimplified] = useState(true);
    const { success, error: showError } = useToast();

    const payments = useMemo(() => {
        return isSimplified ? simplifyDebts(balances) : getRawDebts(balances);
    }, [balances, isSimplified]);

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
            // Record the settlement
            const result = await groupsService.recordSettlement(
                groupId,
                payment.from_user_id,
                payment.to_user_id,
                payment.amount,
                currentUserId
            );

            if (result.success) {
                setSettledPayments((prev) => new Set([...prev, paymentKey]));
                success(`Settlement of $${payment.amount.toFixed(2)} recorded!`, "Payment Settled");
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
                        {isSimplified ? "Simplified Debts" : "All Debts"}
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
                                        {payment.from_is_placeholder && (
                                            <Badge variant="warning" className="text-[10px]">Not signed up</Badge>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                                            ${payment.amount.toFixed(2)}
                                        </span>
                                        {isSettled ? (
                                            <Badge variant="success">Settled</Badge>
                                        ) : youOwe && !payment.to_is_placeholder ? (
                                            <Button
                                                size="sm"
                                                variant="primary"
                                                isLoading={isSettling}
                                                onClick={() => handleSettle(payment)}
                                            >
                                                Settle
                                            </Button>
                                        ) : !youOwe && !payment.from_is_placeholder ? (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                isLoading={isSettling}
                                                onClick={() => handleSettle(payment)}
                                            >
                                                Mark Paid
                                            </Button>
                                        ) : null}
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
                                        {(payment.from_is_placeholder || payment.to_is_placeholder) && (
                                            <Badge variant="warning" className="text-[10px]">Has placeholder</Badge>
                                        )}
                                    </div>
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                                        ${payment.amount.toFixed(2)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}

                <p className="text-xs text-gray-500 dark:text-gray-400 text-center pt-2">
                    {isSimplified
                        ? "💡 Debts are simplified to minimize the number of payments needed"
                        : "📋 Showing all individual debts between members"
                    }
                </p>
            </CardContent>
        </Card>
    );
}

