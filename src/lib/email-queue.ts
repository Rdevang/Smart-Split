/**
 * Email Queue System for Scale
 * 
 * Architecture:
 * 1. Emails are queued in database (not sent inline)
 * 2. Cron job processes queue in batches
 * 3. User preferences are respected
 * 4. Rate limiting prevents overwhelming email provider
 * 5. Retry logic for failed emails
 */

import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "./email";

// Rate limiting: Resend allows 100/second, we'll be conservative
const BATCH_SIZE = 50;
const DELAY_BETWEEN_EMAILS_MS = 50; // 20 emails/second max

interface QueuedEmail {
    id: string;
    to_email: string;
    to_user_id: string | null;
    email_type: string;
    subject: string;
    html_body: string;
    text_body: string | null;
    metadata: Record<string, unknown>;
    attempts: number;
}

/**
 * Queue an email for sending (respects user preferences)
 */
export async function queueEmail(params: {
    userId?: string;
    email: string;
    emailType: string;
    subject: string;
    htmlBody: string;
    textBody?: string;
    metadata?: Record<string, unknown>;
    scheduledFor?: Date;
    idempotencyKey?: string;
}): Promise<{ queued: boolean; skipped?: boolean; error?: string }> {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("queue_email", {
        p_user_id: params.userId || null,
        p_email: params.email,
        p_email_type: params.emailType,
        p_subject: params.subject,
        p_html_body: params.htmlBody,
        p_text_body: params.textBody || null,
        p_metadata: params.metadata || {},
        p_scheduled_for: params.scheduledFor?.toISOString() || new Date().toISOString(),
        p_idempotency_key: params.idempotencyKey || null,
    });

    if (error) {
        console.error("[EmailQueue] Failed to queue email:", error);
        return { queued: false, error: error.message };
    }

    // If data is null, user opted out of this email type
    if (data === null) {
        return { queued: false, skipped: true };
    }

    return { queued: true };
}

/**
 * Process the email queue (called by cron job)
 * Returns number of emails processed
 */
export async function processEmailQueue(): Promise<{
    processed: number;
    sent: number;
    failed: number;
    errors: string[];
}> {
    const supabase = await createClient();
    const errors: string[] = [];
    let sent = 0;
    let failed = 0;

    // Get pending emails (with row locking to prevent duplicate processing)
    const { data: emails, error } = await supabase.rpc("get_pending_emails", {
        p_batch_size: BATCH_SIZE,
    }) as { data: QueuedEmail[] | null; error: Error | null };

    if (error) {
        console.error("[EmailQueue] Failed to fetch pending emails:", error);
        return { processed: 0, sent: 0, failed: 0, errors: [error.message] };
    }

    if (!emails || emails.length === 0) {
        return { processed: 0, sent: 0, failed: 0, errors: [] };
    }

    console.log(`[EmailQueue] Processing ${emails.length} emails...`);

    // Process emails with rate limiting
    for (const email of emails) {
        try {
            const result = await sendEmail({
                to: email.to_email,
                subject: email.subject,
                html: email.html_body,
                text: email.text_body || undefined,
            });

            if (result.success) {
                // Mark as sent
                await supabase.rpc("mark_email_processed", {
                    p_queue_id: email.id,
                    p_status: "sent",
                    p_provider_id: result.id || null,
                    p_error_message: null,
                });
                sent++;
            } else {
                // Mark as failed (will retry if attempts < max_attempts)
                const shouldRetry = email.attempts < 3;
                await supabase.rpc("mark_email_processed", {
                    p_queue_id: email.id,
                    p_status: shouldRetry ? "pending" : "failed",
                    p_provider_id: null,
                    p_error_message: result.error || "Unknown error",
                });
                failed++;
                errors.push(`${email.to_email}: ${result.error}`);
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "Unknown error";
            await supabase.rpc("mark_email_processed", {
                p_queue_id: email.id,
                p_status: email.attempts < 3 ? "pending" : "failed",
                p_provider_id: null,
                p_error_message: errorMsg,
            });
            failed++;
            errors.push(`${email.to_email}: ${errorMsg}`);
        }

        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_EMAILS_MS));
    }

    console.log(`[EmailQueue] Processed: ${emails.length}, Sent: ${sent}, Failed: ${failed}`);

    return {
        processed: emails.length,
        sent,
        failed,
        errors,
    };
}

/**
 * Check if user wants a specific email type
 */
export async function userWantsEmail(userId: string, emailType: string): Promise<boolean> {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("user_wants_email", {
        p_user_id: userId,
        p_email_type: emailType,
    });

    if (error) {
        console.error("[EmailQueue] Failed to check email preference:", error);
        return true; // Default to sending if check fails
    }

    return data === true;
}

/**
 * Get email queue stats (for admin dashboard)
 */
export async function getEmailQueueStats(): Promise<{
    pending: number;
    processing: number;
    sent_today: number;
    failed_today: number;
}> {
    const supabase = await createClient();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [pendingResult, processingResult, sentResult, failedResult] = await Promise.all([
        supabase.from("email_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("email_queue").select("id", { count: "exact", head: true }).eq("status", "processing"),
        supabase.from("email_logs").select("id", { count: "exact", head: true })
            .eq("status", "sent")
            .gte("created_at", today.toISOString()),
        supabase.from("email_logs").select("id", { count: "exact", head: true })
            .eq("status", "failed")
            .gte("created_at", today.toISOString()),
    ]);

    return {
        pending: pendingResult.count || 0,
        processing: processingResult.count || 0,
        sent_today: sentResult.count || 0,
        failed_today: failedResult.count || 0,
    };
}

