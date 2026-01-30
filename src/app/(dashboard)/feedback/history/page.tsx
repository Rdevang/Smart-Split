import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FeedbackHistory } from "@/components/features/feedback/feedback-history";

export const metadata = {
    title: "My Feedback | Smart Split",
    description: "View your submitted feedback and their status",
};

export default async function FeedbackHistoryPage() {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        redirect("/login");
    }

    // Fetch user's feedbacks
    const { data: feedbacks } = await supabase
        .from("feedback")
        .select("id, type, title, description, priority, status, admin_response, created_at, updated_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    return (
        <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    My Feedback
                </h1>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Track the status of your submitted feedback, suggestions, and bug reports.
                </p>
            </div>

            <FeedbackHistory feedbacks={feedbacks || []} />
        </div>
    );
}

