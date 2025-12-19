import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizeForDb, stripHtml, sanitizeUrl } from "@/lib/validation";
import { checkRateLimit, getClientIP, createRateLimitHeaders } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

// ============================================
// GET - Fetch user's feedback submissions
// ============================================
export async function GET() {
    try {
        const supabase = await createClient();

        // Check if user is authenticated
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: "Unauthorized. Please log in to view your feedback." },
                { status: 401 }
            );
        }

        // Fetch user's feedbacks
        const { data: feedbacks, error } = await supabase
            .from("feedback")
            .select("id, type, title, description, priority, status, admin_response, created_at, updated_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

        if (error) {
            logger.error("Failed to fetch feedbacks", new Error(error.message));
            return NextResponse.json(
                { error: "Failed to fetch feedbacks" },
                { status: 500 }
            );
        }

        return NextResponse.json({ feedbacks: feedbacks || [] });
    } catch (err) {
        logger.error("Feedback GET API error", err instanceof Error ? err : new Error(String(err)));
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

// ============================================
// INPUT VALIDATION LIMITS
// ============================================
const LIMITS = {
    TITLE_MAX: 200,
    DESCRIPTION_MAX: 5000,
    EMAIL_MAX: 254,  // RFC 5321
    NAME_MAX: 100,
    URL_MAX: 2000,
    USER_AGENT_MAX: 500,
} as const;

export async function POST(request: NextRequest) {
    const ip = getClientIP(request);

    // Rate limit check for public endpoints
    const rateLimitResult = await checkRateLimit(ip, "public");
    if (!rateLimitResult.success) {
        return NextResponse.json(
            { error: "Too many requests. Please try again later." },
            {
                status: 429,
                headers: createRateLimitHeaders(rateLimitResult),
            }
        );
    }

    try {
        // Check content length header first (fast reject for huge payloads)
        const contentLength = request.headers.get("content-length");
        if (contentLength && parseInt(contentLength) > 50000) { // 50KB max
            return NextResponse.json(
                { error: "Request body too large" },
                { status: 413 }
            );
        }

        const body = await request.json();

        const {
            type,
            title,
            description,
            priority,
            email,
            name,
            user_id,
            user_agent,
            page_url,
        } = body;

        // Validate required fields
        if (!type || !title || !description) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        // ============================================
        // INPUT LENGTH VALIDATION (Security)
        // ============================================
        if (typeof title !== "string" || title.length > LIMITS.TITLE_MAX) {
            return NextResponse.json(
                { error: `Title must be ${LIMITS.TITLE_MAX} characters or less` },
                { status: 400 }
            );
        }

        if (typeof description !== "string" || description.length > LIMITS.DESCRIPTION_MAX) {
            return NextResponse.json(
                { error: `Description must be ${LIMITS.DESCRIPTION_MAX} characters or less` },
                { status: 400 }
            );
        }

        if (email && (typeof email !== "string" || email.length > LIMITS.EMAIL_MAX)) {
            return NextResponse.json(
                { error: "Invalid email" },
                { status: 400 }
            );
        }

        if (name && (typeof name !== "string" || name.length > LIMITS.NAME_MAX)) {
            return NextResponse.json(
                { error: `Name must be ${LIMITS.NAME_MAX} characters or less` },
                { status: 400 }
            );
        }

        if (page_url && (typeof page_url !== "string" || page_url.length > LIMITS.URL_MAX)) {
            return NextResponse.json(
                { error: "Invalid URL" },
                { status: 400 }
            );
        }

        // Validate type
        const validTypes = ["suggestion", "feature_request", "bug_report", "other"];
        if (!validTypes.includes(type)) {
            return NextResponse.json(
                { error: "Invalid feedback type" },
                { status: 400 }
            );
        }

        // Validate priority if provided
        if (priority) {
            const validPriorities = ["low", "medium", "high", "critical"];
            if (!validPriorities.includes(priority)) {
                return NextResponse.json(
                    { error: "Invalid priority" },
                    { status: 400 }
                );
            }
        }

        const supabase = await createClient();

        // SECURITY: Sanitize all text inputs before storage
        const sanitizedTitle = sanitizeForDb(stripHtml(title.trim())).slice(0, LIMITS.TITLE_MAX);
        const sanitizedDescription = sanitizeForDb(stripHtml(description.trim())).slice(0, LIMITS.DESCRIPTION_MAX);
        const sanitizedName = name ? sanitizeForDb(stripHtml(name.trim())).slice(0, LIMITS.NAME_MAX) : null;
        const sanitizedEmail = email ? sanitizeForDb(email.trim().toLowerCase()).slice(0, LIMITS.EMAIL_MAX) : null;
        const sanitizedUrl = page_url ? sanitizeUrl(page_url) : null;

        // Insert feedback with sanitized values
        // Note: Don't use .select() after insert - the SELECT RLS policy
        // references auth.users which anon key can't access
        const { error } = await supabase
            .from("feedback")
            .insert({
                type,
                title: sanitizedTitle,
                description: sanitizedDescription,
                priority: type === "bug_report" ? (priority || "medium") : null,
                status: "submitted",
                email: sanitizedEmail,
                name: sanitizedName,
                user_id: user_id || null,
                user_agent: typeof user_agent === "string" ? user_agent.slice(0, LIMITS.USER_AGENT_MAX) : null,
                page_url: sanitizedUrl?.slice(0, LIMITS.URL_MAX) || null,
            });

        if (error) {
            logger.error("Feedback submission error", new Error(error.message), {
                type,
                errorCode: error.code,
                errorDetails: error.details,
                errorHint: error.hint,
            });
            // Return more specific error in development
            const errorMessage = process.env.NODE_ENV === "development"
                ? `Failed to submit feedback: ${error.message}`
                : "Failed to submit feedback. Please try again later.";
            return NextResponse.json(
                { error: errorMessage },
                { status: 500 }
            );
        }

        logger.info("Feedback submitted", { type });

        return NextResponse.json({
            success: true,
            message: "Feedback submitted successfully",
        });
    } catch (err) {
        logger.error("Feedback API error", err instanceof Error ? err : new Error(String(err)));
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

