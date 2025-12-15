import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Plus, Settings, Users, Receipt, TrendingUp, TrendingDown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExpenseCard } from "@/components/features/expenses/expense-card";
import { AddMemberForm } from "@/components/features/groups/add-member-form";
import { SimplifiedDebts } from "@/components/features/groups/simplified-debts";
import { ShareGroupButton } from "@/components/features/groups/share-group-button";
import { groupsServerService } from "@/services/groups.server";
import { expensesServerService } from "@/services/expenses.server";

interface GroupPageProps {
    params: Promise<{ id: string }>;
}

export default async function GroupPage({ params }: GroupPageProps) {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        redirect("/login");
    }

    const [group, expensesResult, balances] = await Promise.all([
        groupsServerService.getGroup(id),
        expensesServerService.getExpenses(id),
        groupsServerService.getGroupBalances(id),
    ]);

    if (!group) {
        notFound();
    }

    const expenses = expensesResult.data;
    const isAdmin = await groupsServerService.isUserAdmin(id, user.id);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const userBalance = balances.find((b) => b.user_id === user.id)?.balance || 0;

    return (
        <div className="space-y-8">
            {/* Back Link */}
            <Link
                href="/groups"
                className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to Groups
            </Link>

            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-50 to-teal-100 text-3xl dark:from-teal-900/30 dark:to-teal-800/30">
                        {group.category === "trip" ? "✈️" : group.category === "home" ? "🏠" : group.category === "couple" ? "❤️" : "📋"}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{group.name}</h1>
                        {group.description && (
                            <p className="mt-1 text-gray-500 dark:text-gray-400">{group.description}</p>
                        )}
                        <div className="mt-2 flex items-center gap-3">
                            <Badge variant="primary">
                                {group.category?.charAt(0).toUpperCase()}{group.category?.slice(1) || "Other"}
                            </Badge>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                {group.member_count} {group.member_count === 1 ? "member" : "members"}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Link href={`/groups/${id}/expenses/new`}>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Expense
                        </Button>
                    </Link>
                    <ShareGroupButton
                        groupId={id}
                        groupName={group.name}
                        inviteCode={group.invite_code}
                    />
                    {isAdmin && (
                        <Link href={`/groups/${id}/settings`}>
                            <Button variant="outline" size="icon">
                                <Settings className="h-4 w-4" />
                            </Button>
                        </Link>
                    )}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                    <CardContent className="flex items-center gap-4 p-6">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
                            <Receipt className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Total Expenses</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                ${totalExpenses.toFixed(2)}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="flex items-center gap-4 p-6">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${userBalance >= 0
                            ? "bg-green-100 dark:bg-green-900/30"
                            : "bg-red-100 dark:bg-red-900/30"
                            }`}>
                            {userBalance >= 0 ? (
                                <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
                            ) : (
                                <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
                            )}
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Your Balance</p>
                            <p className={`text-2xl font-bold ${userBalance >= 0
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                                }`}>
                                {userBalance >= 0 ? "+" : ""}{userBalance.toFixed(2)}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="flex items-center gap-4 p-6">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
                            <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Members</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {group.member_count}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
                {/* Expenses List */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Expenses
                        </h2>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            {expenses.length} {expenses.length === 1 ? "expense" : "expenses"}
                        </span>
                    </div>

                    {expenses.length === 0 ? (
                        <Card>
                            <CardContent className="flex flex-col items-center py-12">
                                <Receipt className="h-12 w-12 text-gray-300 dark:text-gray-600" />
                                <p className="mt-4 text-gray-500 dark:text-gray-400">No expenses yet</p>
                                <Link href={`/groups/${id}/expenses/new`} className="mt-4">
                                    <Button variant="outline" size="sm">
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add First Expense
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {expenses.map((expense) => (
                                <ExpenseCard
                                    key={expense.id}
                                    expense={expense}
                                    currentUserId={user.id}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Members */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Members</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {group.members.map((member) => {
                                const isPlaceholder = member.is_placeholder;
                                const memberName = isPlaceholder
                                    ? member.placeholder?.name
                                    : member.profile?.full_name;
                                const memberAvatar = isPlaceholder
                                    ? null
                                    : member.profile?.avatar_url;
                                const memberId = isPlaceholder
                                    ? member.placeholder?.id
                                    : member.user_id;
                                const memberBalance = balances.find((b) => b.user_id === memberId)?.balance || 0;

                                return (
                                    <div key={member.id} className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            {memberAvatar ? (
                                                <Image
                                                    src={memberAvatar}
                                                    alt={memberName || ""}
                                                    width={36}
                                                    height={36}
                                                    className="rounded-full"
                                                    unoptimized
                                                />
                                            ) : (
                                                <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium text-white ${isPlaceholder
                                                    ? "bg-gray-400 dark:bg-gray-600"
                                                    : "bg-teal-500"
                                                    }`}>
                                                    {memberName?.[0]?.toUpperCase() || "?"}
                                                </div>
                                            )}
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                        {member.user_id === user.id ? "You" : memberName || "Unknown"}
                                                    </p>
                                                    {isPlaceholder && (
                                                        <Badge variant="warning" className="text-[10px]">Not signed up</Badge>
                                                    )}
                                                </div>
                                                {member.role === "admin" && (
                                                    <Badge variant="default" className="text-[10px]">Admin</Badge>
                                                )}
                                            </div>
                                        </div>
                                        <span className={`text-sm font-medium ${memberBalance >= 0
                                            ? "text-green-600 dark:text-green-400"
                                            : "text-red-600 dark:text-red-400"
                                            }`}>
                                            {memberBalance >= 0 ? "+" : ""}{memberBalance.toFixed(2)}
                                        </span>
                                    </div>
                                );
                            })}

                            {/* Add Member Form */}
                            {isAdmin && (
                                <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
                                    <p className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Add Member
                                    </p>
                                    <AddMemberForm
                                        groupId={id}
                                        userId={user.id}
                                        existingMemberIds={group.members
                                            .filter((m) => !m.is_placeholder)
                                            .map((m) => m.user_id || "")
                                            .filter(Boolean)}
                                        existingMemberNames={group.members
                                            .filter((m) => m.is_placeholder)
                                            .map((m) => m.placeholder?.name || "")
                                            .filter(Boolean)}
                                    />
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Simplified Debts */}
                    <SimplifiedDebts
                        groupId={id}
                        balances={balances}
                        expenses={expenses}
                        currentUserId={user.id}
                    />
                </div>
            </div>
        </div>
    );
}

