import { createClient } from "@/lib/supabase/server";
import { AdminFeedbackList } from "./feedback-list";

export const metadata = {
    title: "Feedback Management | Admin - Smart Split",
};

export default async function AdminFeedbackPage() {
    const supabase = await createClient();

    // Get all feedback with user info
    const { data: feedbacks, error } = await supabase
        .from("feedback")
        .select(`
            id,
            type,
            title,
            description,
            priority,
            status,
            email,
            name,
            user_id,
            admin_response,
            created_at,
            updated_at
        `)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching feedback:", error);
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Feedback Management
                </h1>
                <p className="text-gray-500 dark:text-gray-400">
                    Review and respond to user feedback
                </p>
            </div>

            <AdminFeedbackList feedbacks={feedbacks || []} />
        </div>
    );
}

