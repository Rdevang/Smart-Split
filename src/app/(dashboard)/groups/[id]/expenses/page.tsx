import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, ListPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { groupsCachedServerService } from "@/services/groups.cached.server";
import { expensesCachedServerService } from "@/services/expenses.cached.server";
import { decryptUrlId, encryptUrlId } from "@/lib/url-ids";
import { ExpensesList } from "@/components/features/expenses/expenses-list";

interface ExpensesPageProps {
    params: Promise<{ id: string }>;
}

export default async function ExpensesPage({ params }: ExpensesPageProps) {
    const { id: encryptedId } = await params;
    const id = decryptUrlId(encryptedId);
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
        redirect("/login");
    }
    const user = session.user;

    const [group, expensesResult, isAdmin] = await Promise.all([
        groupsCachedServerService.getGroup(id),
        expensesCachedServerService.getExpenses(id),
        groupsCachedServerService.isUserAdmin(id, user.id),
    ]);

    if (!group) {
        notFound();
    }

    const expenses = expensesResult.data || [];
    const currency = group.currency || "USD";
    const members = group.members || [];

    return (
        <div className="space-y-6">
            {/* Back Link */}
            <Link
                href={`/groups/${encryptUrlId(id)}`}
                className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to {group.name}
            </Link>

            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Expenses
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">
                        {expenses.length} {expenses.length === 1 ? "expense" : "expenses"} in {group.name}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link href={`/groups/${encryptUrlId(id)}/expenses/new`}>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Expense
                        </Button>
                    </Link>
                    <Link href={`/groups/${encryptUrlId(id)}/expenses/bulk`}>
                        <Button variant="outline">
                            <ListPlus className="mr-2 h-4 w-4" />
                            Bulk Add
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Expenses List with Edit/Delete */}
            <ExpensesList
                groupId={id}
                expenses={expenses}
                members={members}
                currentUserId={user.id}
                currency={currency}
                isAdmin={isAdmin}
            />
        </div>
    );
}

