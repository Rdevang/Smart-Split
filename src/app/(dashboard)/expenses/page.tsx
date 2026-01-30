import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { expensesCachedServerService } from "@/services/expenses.cached.server";
import { groupsCachedServerService } from "@/services/groups.cached.server";
import { ExpensesPageWrapper } from "@/components/features/expenses/expenses-page-wrapper";
import { encryptUrlId } from "@/lib/url-ids";
import type { ExpenseCardExpense } from "@/components/features/expenses/expense-card";

export default async function ExpensesPage() {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        redirect("/login");
    }

    // ALL queries run in parallel - no sequential waterfalls!
    const [groupsResult, expensesResult, profileResult] = await Promise.all([
        groupsCachedServerService.getGroups(user.id),
        expensesCachedServerService.getUserExpenses(user.id, { limit: 20 }),
        // Profile query also in parallel for currency preference
        supabase.from("profiles").select("currency").eq("id", user.id).single(),
    ]);

    const groups = (groupsResult?.data || []).map((g) => ({
        id: encryptUrlId(g.id),
        name: g.name,
    }));

    // Map expenses to include group_id for edit functionality
    const recentExpenses = (expensesResult?.data || []).map((expense) => ({
        ...expense,
        group_id: expense.group_id,
    })) as ExpenseCardExpense[];

    const currency = profileResult.data?.currency || "USD";

    // Calculate totals
    const totalOwed = recentExpenses.reduce((sum, expense) => {
        if (expense.paid_by === user.id) {
            const othersOwe = (expense.splits || [])
                .filter((s) => s.user_id !== user.id && !s.is_settled)
                .reduce((s, split) => s + split.amount, 0);
            return sum + othersOwe;
        }
        return sum;
    }, 0);

    const totalOwe = recentExpenses.reduce((sum, expense) => {
        if (expense.paid_by !== user.id) {
            const userSplit = (expense.splits || []).find((s) => s.user_id === user.id && !s.is_settled);
            return sum + (userSplit?.amount || 0);
        }
        return sum;
    }, 0);

    return (
        <ExpensesPageWrapper
            groups={groups}
            expenses={recentExpenses}
            totalOwed={totalOwed}
            totalOwe={totalOwe}
            currency={currency}
            currentUserId={user.id}
        />
    );
}
