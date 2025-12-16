"use client";

import { useRouter } from "next/navigation";
import { SimplifiedDebts } from "./simplified-debts";
import { onSettlementMutation } from "@/app/(dashboard)/actions";
import type { Balance } from "@/lib/simplify-debts";

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

interface SimplifiedDebtsClientProps {
    groupId: string;
    balances: Balance[];
    expenses: Expense[];
    currentUserId: string;
    currency?: string;
}

/**
 * Client wrapper for SimplifiedDebts that handles page refresh after settlement
 */
export function SimplifiedDebtsClient({ groupId, balances, expenses, currentUserId, currency = "USD" }: SimplifiedDebtsClientProps) {
    const router = useRouter();

    const handleSettle = async (fromUserId: string, toUserId: string) => {
        // Invalidate cache for the group and involved users
        await onSettlementMutation(groupId, fromUserId, toUserId);
        // Refresh the page to get updated balances
        router.refresh();
    };

    return (
        <SimplifiedDebts
            groupId={groupId}
            balances={balances}
            expenses={expenses}
            currentUserId={currentUserId}
            currency={currency}
            onSettle={handleSettle}
        />
    );
}
