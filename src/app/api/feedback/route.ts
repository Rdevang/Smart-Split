/**
 * Feedback API
 * 
 * GET /api/feedback - Fetch user's feedback submissions (requires auth)
 * POST /api/feedback - Submit new feedback (public, with rate limiting and reCAPTCHA)
 */

import { z } from "zod";
import { createRoute, withAuth, withRateLimit, withValidation, withOptionalAuth, ApiResponse, ApiError, type AuthContext, type OptionalAuthContext, type ValidatedContext } from "@/lib/api";
import { sanitizeForDb, stripHtml, sanitizeUrl } from "@/lib/validation";
import { logger } from "@/lib/logger";
import { verifyRecaptcha } from "@/lib/recaptcha";

// ============================================
// INPUT VALIDATION
// ============================================

const LIMITS = {
    TITLE_MAX: 200,
    DESCRIPTION_MAX: 5000,
    EMAIL_MAX: 254,
    NAME_MAX: 100,
    URL_MAX: 2000,
    USER_AGENT_MAX: 500,
} as const;

const FeedbackSchema = z.object({
    type: z.enum(["suggestion", "feature_request", "bug_report", "review", "other"]),
    title: z.string().min(1).max(LIMITS.TITLE_MAX),
    description: z.string().min(1).max(LIMITS.DESCRIPTION_MAX),
    priority: z.enum(["low", "medium", "high", "critical"]).optional(),
    rating: z.number().min(1).max(5).optional(),
    email: z.string().email().max(LIMITS.EMAIL_MAX).optional(),
    name: z.string().max(LIMITS.NAME_MAX).optional(),
    user_id: z.string().uuid().optional(),
    user_agent: z.string().max(LIMITS.USER_AGENT_MAX).optional(),
    page_url: z.string().max(LIMITS.URL_MAX).optional(),
    recaptcha_token: z.string().optional(),
});

// ============================================
// GET - Fetch user's feedback submissions
// ============================================

export const GET = createRoute()
    .use(withAuth())
    .handler(async (ctx) => {
        const { user, supabase } = ctx as AuthContext;
        const { data: feedbacks, error } = await supabase
            .from("feedback")
            .select("id, type, title, description, priority, status, admin_response, created_at, updated_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

        if (error) {
            logger.error("Failed to fetch feedbacks", new Error(error.message));
            return ApiError.internal("Failed to fetch feedbacks");
        }

        return ApiResponse.success({ feedbacks: feedbacks || [] });
    });

// ============================================
// POST - Submit new feedback (public)
// ============================================

// Combined context type for POST handler
type FeedbackPostContext = OptionalAuthContext & ValidatedContext<z.infer<typeof FeedbackSchema>>;

export const POST = createRoute()
    .use(withOptionalAuth()) // Allow anonymous submissions
    .use(withRateLimit("public"))
    .use(withValidation(FeedbackSchema, { maxSize: 50000 })) // 50KB max
    .handler(async (ctx) => {
        const { user, validated: data, supabase } = ctx as unknown as FeedbackPostContext;

        // reCAPTCHA Verification (checks if enabled in settings)
        const isAuthenticated = !!user;
        const recaptchaResult = await verifyRecaptcha(data.recaptcha_token, "feedback", isAuthenticated);
        if (!recaptchaResult.success) {
            logger.warn("Feedback submission blocked by reCAPTCHA", {
                error: recaptchaResult.error,
                score: recaptchaResult.score,
            });
            return ApiError.badRequest(recaptchaResult.error || "Security verification failed");
        }

        // Validate rating for reviews
        if (data.type === "review") {
            if (!data.rating || data.rating < 1 || data.rating > 5) {
                return ApiError.badRequest("Rating must be between 1 and 5 for reviews");
            }
        }

        // SECURITY: Sanitize all text inputs before storage
        const sanitizedTitle = sanitizeForDb(stripHtml(data.title.trim())).slice(0, LIMITS.TITLE_MAX);
        const sanitizedDescription = sanitizeForDb(stripHtml(data.description.trim())).slice(0, LIMITS.DESCRIPTION_MAX);
        const sanitizedName = data.name ? sanitizeForDb(stripHtml(data.name.trim())).slice(0, LIMITS.NAME_MAX) : null;
        const sanitizedEmail = data.email ? sanitizeForDb(data.email.trim().toLowerCase()).slice(0, LIMITS.EMAIL_MAX) : null;
        const sanitizedUrl = data.page_url ? sanitizeUrl(data.page_url) : null;

        // Insert feedback
        const { error } = await supabase
            .from("feedback")
            .insert({
                type: data.type,
                title: sanitizedTitle,
                description: sanitizedDescription,
                priority: data.type === "bug_report" ? (data.priority || "medium") : null,
                status: "submitted",
                email: sanitizedEmail,
                name: sanitizedName,
                user_id: data.user_id || user?.id || null,
                user_agent: data.user_agent ? data.user_agent.slice(0, LIMITS.USER_AGENT_MAX) : null,
                page_url: sanitizedUrl?.slice(0, LIMITS.URL_MAX) || null,
            });

        if (error) {
            logger.error("Feedback submission error", new Error(error.message), {
                type: data.type,
                errorCode: error.code,
                errorDetails: error.details,
                errorHint: error.hint,
            });
            const errorMessage = process.env.NODE_ENV === "development"
                ? `Failed to submit feedback: ${error.message}`
                : "Failed to submit feedback. Please try again later.";
            return ApiError.internal(errorMessage);
        }

        // If this is a review, also create an entry in the reviews table
        if (data.type === "review") {
            const { error: reviewError } = await supabase
                .from("reviews")
                .insert({
                    user_id: data.user_id || user?.id || null,
                    author_name: sanitizedName || "Anonymous",
                    author_title: null,
                    content: sanitizedDescription,
                    rating: data.rating,
                    is_approved: false,
                    is_featured: false,
                });

            if (reviewError) {
                logger.error("Review creation error", new Error(reviewError.message));
                // Don't fail the whole request - feedback was saved
            }
        }

        logger.info("Feedback submitted", { type: data.type, rating: data.type === "review" ? data.rating : undefined });

        return ApiResponse.success({
            success: true,
            message: data.type === "review"
                ? "Thank you for your review! It will be visible after approval."
                : "Feedback submitted successfully",
        });
    });
