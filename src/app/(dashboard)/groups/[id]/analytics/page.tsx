import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft, TrendingUp, TrendingDown, Crown, Flame, Zap,
    Calendar, Sparkles, ArrowUpRight, ChevronRight, Star
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { groupsCachedServerService } from "@/services/groups.cached.server";
import { expensesCachedServerService } from "@/services/expenses.cached.server";
import { formatCurrency } from "@/lib/currency";
import { decryptUrlId, encryptUrlId } from "@/lib/url-ids";
import { AnalyticsClient } from "./analytics-client";

interface AnalyticsPageProps {
    params: Promise<{ id: string }>;
}

export default async function AnalyticsPage({ params }: AnalyticsPageProps) {
    const { id: encryptedId } = await params;
    const id = decryptUrlId(encryptedId);
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        redirect("/login");
    }

    const [group, expensesResult, balances] = await Promise.all([
        groupsCachedServerService.getGroup(id),
        expensesCachedServerService.getExpenses(id),
        groupsCachedServerService.getGroupBalances(id),
    ]);

    if (!group) {
        notFound();
    }

    const expenses = expensesResult.data;
    const currency = group.currency || "USD";

    return (
        <div className="min-h-screen">
            {/* Back Link */}
            <Link
                href={`/groups/${encryptUrlId(id)}`}
                className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors mb-6"
            >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to {group.name}</span>
            </Link>

            <AnalyticsClient
                group={group}
                expenses={expenses}
                balances={balances}
                currency={currency}
                currentUserId={user.id}
                encryptedGroupId={encryptUrlId(id)}
            />
        </div>
    );
}
