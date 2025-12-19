import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MessageSquare, UserCheck, UserX, Clock, CheckCircle } from "lucide-react";
import { Link } from "@/components/ui/link";

export const metadata = {
    title: "Admin Dashboard | Smart Split",
};

export default async function AdminDashboardPage() {
    const supabase = await createClient();

    // Get user stats
    const { count: totalUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

    // Get users created in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { count: newUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", thirtyDaysAgo.toISOString());

    // Get feedback stats
    const { count: totalFeedback } = await supabase
        .from("feedback")
        .select("*", { count: "exact", head: true });

    const { count: pendingFeedback } = await supabase
        .from("feedback")
        .select("*", { count: "exact", head: true })
        .in("status", ["submitted", "new", "under_review", "reviewing"]);

    const { count: resolvedFeedback } = await supabase
        .from("feedback")
        .select("*", { count: "exact", head: true })
        .in("status", ["approved", "completed", "rejected", "declined", "closed"]);

    // Get recent feedback
    const { data: recentFeedback } = await supabase
        .from("feedback")
        .select("id, type, title, status, created_at")
        .order("created_at", { ascending: false })
        .limit(5);

    // Get recent users
    const { data: recentUsers } = await supabase
        .from("profiles")
        .select("id, full_name, email, created_at")
        .order("created_at", { ascending: false })
        .limit(5);

    const stats = [
        { 
            label: "Total Users", 
            value: totalUsers || 0, 
            icon: Users, 
            color: "text-blue-500",
            bg: "bg-blue-50 dark:bg-blue-900/20",
            href: "/admin/users"
        },
        { 
            label: "New Users (30d)", 
            value: newUsers || 0, 
            icon: UserCheck, 
            color: "text-green-500",
            bg: "bg-green-50 dark:bg-green-900/20",
            href: "/admin/users"
        },
        { 
            label: "Total Feedback", 
            value: totalFeedback || 0, 
            icon: MessageSquare, 
            color: "text-purple-500",
            bg: "bg-purple-50 dark:bg-purple-900/20",
            href: "/admin/feedback"
        },
        { 
            label: "Pending Feedback", 
            value: pendingFeedback || 0, 
            icon: Clock, 
            color: "text-yellow-500",
            bg: "bg-yellow-50 dark:bg-yellow-900/20",
            href: "/admin/feedback?status=pending"
        },
    ];

    const statusColors: Record<string, string> = {
        submitted: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
        new: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
        under_review: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
        reviewing: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
        approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
        completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
        rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
        declined: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
        closed: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Dashboard
                </h1>
                <p className="text-gray-500 dark:text-gray-400">
                    Overview of your application
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat) => (
                    <Link key={stat.label} href={stat.href}>
                        <Card className="transition-shadow hover:shadow-md">
                            <CardContent className="p-6">
                                <div className="flex items-center gap-4">
                                    <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${stat.bg}`}>
                                        <stat.icon className={`h-6 w-6 ${stat.color}`} />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                            {stat.value}
                                        </p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            {stat.label}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>

            {/* Recent Activity */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Recent Feedback */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-lg">Recent Feedback</CardTitle>
                        <Link href="/admin/feedback" className="text-sm text-teal-600 hover:underline dark:text-teal-400">
                            View all
                        </Link>
                    </CardHeader>
                    <CardContent>
                        {recentFeedback && recentFeedback.length > 0 ? (
                            <div className="space-y-3">
                                {recentFeedback.map((feedback) => (
                                    <div key={feedback.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                                                {feedback.title}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {feedback.type.replace("_", " ")}
                                            </p>
                                        </div>
                                        <span className={`ml-2 rounded-full px-2 py-1 text-xs font-medium ${statusColors[feedback.status] || statusColors.submitted}`}>
                                            {feedback.status.replace("_", " ")}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">
                                No feedback yet
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Recent Users */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-lg">Recent Users</CardTitle>
                        <Link href="/admin/users" className="text-sm text-teal-600 hover:underline dark:text-teal-400">
                            View all
                        </Link>
                    </CardHeader>
                    <CardContent>
                        {recentUsers && recentUsers.length > 0 ? (
                            <div className="space-y-3">
                                {recentUsers.map((user) => (
                                    <div key={user.id} className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-sm font-medium text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
                                            {user.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "?"}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                                                {user.full_name || "No name"}
                                            </p>
                                            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                                                {user.email}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">
                                No users yet
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

