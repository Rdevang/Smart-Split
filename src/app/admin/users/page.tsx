import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Search } from "lucide-react";

export const metadata = {
    title: "User Management | Admin - Smart Split",
};

interface Profile {
    id: string;
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
    role: string | null;
    created_at: string;
    updated_at: string;
}

export default async function AdminUsersPage() {
    const supabase = await createClient();

    // Get all users with their profiles
    const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url, role, created_at, updated_at")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching profiles:", error);
    }

    const users = (profiles || []) as Profile[];

    // Calculate stats
    const totalUsers = users.length;
    const adminUsers = users.filter(u => u.role === "admin" || u.role === "site_admin").length;
    const recentUsers = users.filter(u => {
        const createdAt = new Date(u.created_at);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return createdAt > sevenDaysAgo;
    }).length;

    const roleColors: Record<string, string> = {
        site_admin: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
        admin: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
        user: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    User Management
                </h1>
                <p className="text-gray-500 dark:text-gray-400">
                    View and manage all registered users
                </p>
            </div>

            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20">
                                <Users className="h-5 w-5 text-blue-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalUsers}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Total Users</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-900/20">
                                <Users className="h-5 w-5 text-purple-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{adminUsers}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Admins</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 dark:bg-green-900/20">
                                <Users className="h-5 w-5 text-green-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{recentUsers}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">New (7 days)</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Users Table */}
            <Card>
                <CardHeader>
                    <CardTitle>All Users</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-gray-700">
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                        User
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                        Role
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                        Joined
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                        Last Active
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {users.map((user) => (
                                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                        <td className="whitespace-nowrap px-4 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-sm font-medium text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
                                                    {user.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "?"}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-900 dark:text-white">
                                                        {user.full_name || "No name"}
                                                    </p>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                                        {user.email}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-4">
                                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${roleColors[user.role || "user"]}`}>
                                                {user.role === "site_admin" ? "Site Admin" : user.role === "admin" ? "Admin" : "User"}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                                            {formatDate(user.created_at)}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                                            {formatDate(user.updated_at)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {users.length === 0 && (
                        <div className="py-12 text-center">
                            <Users className="mx-auto h-12 w-12 text-gray-400" />
                            <p className="mt-4 text-gray-500 dark:text-gray-400">No users found</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

