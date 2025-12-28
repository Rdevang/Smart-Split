import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MessageSquare, UserCheck, Clock, Shield } from "lucide-react";
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

    // Get rate limit stats
    const { count: rateLimitRoutes } = await supabase
        .from("rate_limit_settings")
        .select("*", { count: "exact", head: true });

    const { count: enabledRateLimits } = await supabase
        .from("rate_limit_settings")
        .select("*", { count: "exact", head: true })
        .eq("is_enabled", true);

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
            label: "Rate Limits", 
            value: `${enabledRateLimits || 0}/${rateLimitRoutes || 0}`, 
            icon: Shield, 
            color: "text-orange-500",
            bg: "bg-orange-50 dark:bg-orange-900/20",
            href: "/admin/rate-limits"
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
        <div className="space-y-4 sm:space-y-6">
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                    Dashboard
                </h1>
                <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">
                    Overview of your application
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                {stats.map((stat) => (
                    <Link key={stat.label} href={stat.href}>
                        <Card className="transition-shadow hover:shadow-md h-full">
                            <CardContent className="p-4 sm:p-6">
                                <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
                                    <div className={`flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg ${stat.bg}`}>
                                        <stat.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${stat.color}`} />
                                    </div>
                                    <div>
                                        <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                                            {stat.value}
                                        </p>
                                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
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
            <div className="grid gap-3 sm:gap-6 lg:grid-cols-2">
                {/* Recent Feedback */}
                <Card className="overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between px-4 py-4 sm:p-6">
                        <CardTitle className="text-base sm:text-lg">Recent Feedback</CardTitle>
                        <Link href="/admin/feedback" className="text-xs sm:text-sm text-teal-600 hover:underline dark:text-teal-400">
                            View all
                        </Link>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 sm:p-6 sm:pt-0">
                        {recentFeedback && recentFeedback.length > 0 ? (
                            <div className="space-y-2 sm:space-y-3">
                                {recentFeedback.map((feedback) => (
                                    <div key={feedback.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-2.5 sm:p-3 dark:border-gray-700">
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                                                {feedback.title}
                                            </p>
                                            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                                                {feedback.type.replace("_", " ")}
                                            </p>
                                        </div>
                                        <span className={`ml-2 shrink-0 rounded-full px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium ${statusColors[feedback.status] || statusColors.submitted}`}>
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
                <Card className="overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between px-4 py-4 sm:p-6">
                        <CardTitle className="text-base sm:text-lg">Recent Users</CardTitle>
                        <Link href="/admin/users" className="text-xs sm:text-sm text-teal-600 hover:underline dark:text-teal-400">
                            View all
                        </Link>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 sm:p-6 sm:pt-0">
                        {recentUsers && recentUsers.length > 0 ? (
                            <div className="space-y-2 sm:space-y-3">
                                {recentUsers.map((user) => (
                                    <div key={user.id} className="flex items-center gap-2.5 sm:gap-3 rounded-lg border border-gray-200 p-2.5 sm:p-3 dark:border-gray-700">
                                        <div className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs sm:text-sm font-medium text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
                                            {user.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "?"}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                                                {user.full_name || "No name"}
                                            </p>
                                            <p className="truncate text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
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

