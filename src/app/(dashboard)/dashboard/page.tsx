import { redirect } from "next/navigation";
import Link from "next/link";
import {
    Plus, Users, Receipt, TrendingUp, TrendingDown,
    ArrowRight, QrCode
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import { encryptUrlId } from "@/lib/url-ids";

// ============================================
// OPTIMIZED: Single data fetch, no Suspense overhead
// Trade streaming for faster total load time
// ============================================

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function DashboardPage() {
    const supabase = await createClient();

    // Use getSession() - reads from cookie (~0ms)
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
        redirect("/login");
    }

    const userId = session.user.id;

    // SINGLE BATCH: All queries in parallel - 6 queries instead of 9
    const [
        profileResult,
        groupMembershipsResult,
        paidByUserResult,
        userSplitsResult,
        recentExpensesResult,
    ] = await Promise.all([
        supabase.from("profiles").select("full_name, currency").eq("id", userId).single(),
        supabase.from("group_members").select("group_id, groups!inner(id, name, description, category)").eq("user_id", userId).limit(3),
        supabase.from("expense_splits").select("amount, expense:expenses!inner(paid_by)").eq("is_settled", false).neq("user_id", userId),
        supabase.from("expense_splits").select("amount, expense:expenses!inner(paid_by)").eq("user_id", userId).eq("is_settled", false),
        supabase.from("expenses").select("id, description, amount, expense_date").eq("paid_by", userId).order("expense_date", { ascending: false }).limit(5),
    ]);

    // Extract data
    const profile = profileResult.data;
    const firstName = profile?.full_name?.split(" ")[0] || "there";
    const currency = profile?.currency || "USD";

    const groups = (groupMembershipsResult.data || []).map((m: any) => m.groups);
    const firstGroupId = groups[0]?.id;
    const groupCount = groups.length;

    const totalOwed = (paidByUserResult.data || [])
        .filter((s: any) => (Array.isArray(s.expense) ? s.expense[0] : s.expense)?.paid_by === userId)
        .reduce((sum: number, s: any) => sum + (s.amount || 0), 0);
    const totalOwe = (userSplitsResult.data || [])
        .filter((s: any) => (Array.isArray(s.expense) ? s.expense[0] : s.expense)?.paid_by !== userId)
        .reduce((sum: number, s: any) => sum + (s.amount || 0), 0);
    const netBalance = totalOwed - totalOwe;

    const expenses = recentExpensesResult.data || [];

    return (
        <div className="space-y-8">
            {/* Welcome Header */}
            <div className="flex flex-col gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                        Welcome back, {firstName}! 👋
                    </h1>
                    <p className="mt-1 text-sm sm:text-base text-gray-500 dark:text-gray-400">
                        Here&apos;s what&apos;s happening with your expenses
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link href="/groups/join">
                        <Button variant="outline" size="sm">
                            <QrCode className="mr-1.5 h-4 w-4" />
                            Join
                        </Button>
                    </Link>
                    <Link href="/groups/new">
                        <Button variant="outline" size="sm">
                            <Users className="mr-1.5 h-4 w-4" />
                            New Group
                        </Button>
                    </Link>
                    {firstGroupId && (
                        <Link href={`/groups/${encryptUrlId(firstGroupId)}/expenses/new`}>
                            <Button size="sm">
                                <Plus className="mr-1.5 h-4 w-4" />
                                Add Expense
                            </Button>
                        </Link>
                    )}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card><CardContent className="flex items-center gap-4 p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/30">
                        <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">You are owed</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totalOwed, currency)}</p>
                    </div>
                </CardContent></Card>
                <Card><CardContent className="flex items-center gap-4 p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/30">
                        <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">You owe</p>
                        <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(totalOwe, currency)}</p>
                    </div>
                </CardContent></Card>
                <Card><CardContent className="flex items-center gap-4 p-6">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${netBalance >= 0 ? "bg-teal-100 dark:bg-teal-900/30" : "bg-orange-100 dark:bg-orange-900/30"}`}>
                        <Receipt className={`h-6 w-6 ${netBalance >= 0 ? "text-teal-600 dark:text-teal-400" : "text-orange-600 dark:text-orange-400"}`} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Net Balance</p>
                        <p className={`text-2xl font-bold ${netBalance >= 0 ? "text-teal-600 dark:text-teal-400" : "text-orange-600 dark:text-orange-400"}`}>
                            {netBalance >= 0 ? "+" : ""}{formatCurrency(Math.abs(netBalance), currency)}
                        </p>
                    </div>
                </CardContent></Card>
                <Card><CardContent className="flex items-center gap-4 p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
                        <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Active Groups</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{groupCount}</p>
                    </div>
                </CardContent></Card>
            </div>

            {/* Content Grid */}
            <div className="grid gap-8 lg:grid-cols-3">
                {/* Groups */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Your Groups</h2>
                        <Link href="/groups" className="text-sm text-teal-600 hover:text-teal-700 dark:text-teal-400">
                            View all <ArrowRight className="ml-1 inline h-4 w-4" />
                        </Link>
                    </div>
                    {groups.length === 0 ? (
                        <Card><CardContent className="flex flex-col items-center py-12">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900/30">
                                <Users className="h-8 w-8 text-teal-600 dark:text-teal-400" />
                            </div>
                            <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">No groups yet</h3>
                            <p className="mt-2 text-center text-gray-500 dark:text-gray-400">Create your first group to start splitting expenses.</p>
                            <div className="mt-6 flex gap-3">
                                <Link href="/groups/join"><Button variant="outline"><QrCode className="mr-2 h-4 w-4" />Join</Button></Link>
                                <Link href="/groups/new"><Button><Plus className="mr-2 h-4 w-4" />Create</Button></Link>
                            </div>
                        </CardContent></Card>
                    ) : (
                        <div className="grid gap-4">
                            {groups.map((g: any) => (
                                <Link key={g.id} href={`/groups/${encryptUrlId(g.id)}`}>
                                    <Card className="transition-all hover:shadow-md hover:border-teal-200 dark:hover:border-teal-800">
                                        <CardContent className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-teal-50 to-teal-100 text-2xl dark:from-teal-900/30 dark:to-teal-800/30">
                                                    {g.category === "trip" ? "✈️" : g.category === "home" ? "🏠" : g.category === "couple" ? "❤️" : "📋"}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">{g.name}</h3>
                                                    {g.description && <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{g.description}</p>}
                                                </div>
                                                <ArrowRight className="h-5 w-5 text-gray-400" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {/* Expenses */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Expenses</h2>
                        <Link href="/expenses" className="text-sm text-teal-600 hover:text-teal-700 dark:text-teal-400">
                            View all <ArrowRight className="ml-1 inline h-4 w-4" />
                        </Link>
                    </div>
                    {expenses.length === 0 ? (
                        <Card><CardContent className="flex flex-col items-center py-8">
                            <Receipt className="h-10 w-10 text-gray-300 dark:text-gray-600" />
                            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">No expenses yet</p>
                        </CardContent></Card>
                    ) : (
                        <div className="space-y-3">
                            {expenses.map((e) => (
                                <Card key={e.id}><CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium text-gray-900 dark:text-white truncate">{e.description}</p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">{new Date(e.expense_date).toLocaleDateString()}</p>
                                        </div>
                                        <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(e.amount, currency)}</p>
                                    </div>
                                </CardContent></Card>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/* eslint-enable @typescript-eslint/no-explicit-any */
