/**
 * PATCH /api/admin/feedback/[id]
 * 
 * Update feedback status and response.
 * Requires admin authentication.
 */

import { z } from "zod";
import { createRoute, withAdminAuth, withValidation, ApiResponse, ApiError } from "@/lib/api";
import { log } from "@/lib/console-logger";

const UpdateFeedbackSchema = z.object({
    status: z.enum(["submitted", "under_review", "approved", "rejected", "closed"]).optional(),
    admin_response: z.string().optional(),
});

export const PATCH = createRoute()
    .use(withAdminAuth())
    .use(withValidation(UpdateFeedbackSchema))
    .handler(async (ctx) => {
        const feedbackId = ctx.params.id;
        const { status, admin_response } = ctx.validated;

        // Get the feedback first to check user_id and previous response
        const { data: feedback } = await ctx.supabase
            .from("feedback")
            .select("user_id, title, admin_response")
            .eq("id", feedbackId)
            .single();

        if (!feedback) {
            return ApiError.notFound("Feedback");
        }

        // Update feedback
        const updateData: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        };

        if (status) {
            updateData.status = status;
        }

        const isNewResponse = admin_response && admin_response.trim() !== "" &&
            admin_response !== feedback.admin_response;

        if (admin_response !== undefined) {
            updateData.admin_response = admin_response;
            updateData.responded_at = new Date().toISOString();
        }

        const { error } = await ctx.supabase
            .from("feedback")
            .update(updateData)
            .eq("id", feedbackId);

        if (error) {
            log.error("Admin", "Failed to update feedback", error);
            return ApiError.internal("Failed to update feedback");
        }

        // Create notification for the user if there's a new admin response
        if (isNewResponse && feedback.user_id) {
            const statusLabel = status ? status.replace("_", " ") : "updated";

            await ctx.supabase.from("notifications").insert({
                user_id: feedback.user_id,
                type: "feedback_response",
                title: "Response to your feedback",
                message: `Your feedback "${feedback.title}" has been ${statusLabel}. Check the response from our team.`,
                data: { feedback_id: feedbackId, status },
                action_url: "/feedback/history",
            });
        }

        return ApiResponse.success({ success: true });
    });
