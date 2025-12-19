import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// PATCH - Update feedback status and response
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = await createClient();

        // Check if user is authenticated and is admin
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Check admin role
        const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();

        if (profile?.role !== "admin" && profile?.role !== "site_admin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const { status, admin_response } = body;

        // Validate status
        const validStatuses = ["submitted", "under_review", "approved", "rejected", "closed"];
        if (status && !validStatuses.includes(status)) {
            return NextResponse.json({ error: "Invalid status" }, { status: 400 });
        }

        // Get the feedback first to check user_id and previous response
        const { data: feedback } = await supabase
            .from("feedback")
            .select("user_id, title, admin_response")
            .eq("id", id)
            .single();

        // Update feedback
        const updateData: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        };

        if (status) {
            updateData.status = status;
        }

        const isNewResponse = admin_response && admin_response.trim() !== "" &&
            admin_response !== feedback?.admin_response;

        if (admin_response !== undefined) {
            updateData.admin_response = admin_response;
            updateData.responded_at = new Date().toISOString();
        }

        const { error } = await supabase
            .from("feedback")
            .update(updateData)
            .eq("id", id);

        if (error) {
            console.error("Error updating feedback:", error);
            return NextResponse.json({ error: "Failed to update feedback" }, { status: 500 });
        }

        // Create notification for the user if there's a new admin response
        if (isNewResponse && feedback?.user_id) {
            const statusLabel = status ? status.replace("_", " ") : "updated";

            await supabase.from("notifications").insert({
                user_id: feedback.user_id,
                type: "feedback_response",
                title: "Response to your feedback",
                message: `Your feedback "${feedback.title}" has been ${statusLabel}. Check the response from our team.`,
                data: { feedback_id: id, status },
                action_url: "/feedback/history",
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Admin feedback API error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

