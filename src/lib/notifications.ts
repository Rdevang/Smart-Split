/**
 * Non-blocking Notification System
 * 
 * All notification operations (email, in-app, push) are:
 * 1. Completely asynchronous (fire-and-forget)
 * 2. Non-blocking (never stop the main operation)
 * 3. Error-tolerant (log failures, never throw)
 * 4. Rate-limit aware (gracefully handle limits)
 */

import { queueEmail } from "./email-queue";
import {
    generatePaymentReminderHtml,
    generateGroupInvitationHtml,
    generateSettlementRequestHtml,
} from "./email";
import { logger } from "@/lib/logger";

// Log levels for notification events
type NotificationLogLevel = "info" | "warn" | "error";

interface NotificationLog {
    timestamp: string;
    type: string;
    level: NotificationLogLevel;
    message: string;
    metadata?: Record<string, unknown>;
}

// In-memory buffer for recent notification logs (last 100)
const notificationLogs: NotificationLog[] = [];
const MAX_LOGS = 100;

function log(level: NotificationLogLevel, type: string, message: string, metadata?: Record<string, unknown>) {
    const entry: NotificationLog = {
        timestamp: new Date().toISOString(),
        type,
        level,
        message,
        metadata,
    };

    notificationLogs.push(entry);
    if (notificationLogs.length > MAX_LOGS) {
        notificationLogs.shift();
    }

    const logMessage = `[Notification:${type}] ${message}`;

    if (level === "error") {
        logger.error(logMessage, undefined, metadata);
    } else if (level === "warn") {
        logger.warn(logMessage, metadata);
    } else {
        logger.info(logMessage, metadata);
    }
}

/**
 * Fire-and-forget wrapper for async operations
 * Never throws, never blocks, always returns immediately
 */
function fireAndForget<T>(
    operationName: string,
    operation: () => Promise<T>,
    onSuccess?: (result: T) => void,
    onError?: (error: Error) => void
): void {
    // Start the operation but don't wait for it
    operation()
        .then((result) => {
            log("info", operationName, "Completed successfully");
            onSuccess?.(result);
        })
        .catch((error) => {
            const err = error instanceof Error ? error : new Error(String(error));

            // Check for rate limit errors
            if (err.message.includes("rate limit") || err.message.includes("Rate limit")) {
                log("warn", operationName, "Rate limit reached - notification skipped", { error: err.message });
            } else {
                log("error", operationName, "Failed", { error: err.message });
            }

            onError?.(err);
        });
}

// ============================================
// EMAIL NOTIFICATIONS (Non-blocking)
// ============================================

interface EmailNotificationResult {
    queued: boolean;
    skipped?: boolean;
    rateLimited?: boolean;
}

/**
 * Queue a payment reminder email (non-blocking)
 * Returns immediately, email is processed in background
 */
export function notifyPaymentReminder(params: {
    userId: string;
    email: string;
    debtorName: string;
    creditorName: string;
    amount: string;
    groupName: string;
    paymentLink?: string;
}): void {
    fireAndForget(
        "payment_reminder",
        async (): Promise<EmailNotificationResult> => {
            const { subject, html } = generatePaymentReminderHtml({
                debtorName: params.debtorName,
                creditorName: params.creditorName,
                amount: params.amount,
                groupName: params.groupName,
                paymentLink: params.paymentLink,
            });

            const result = await queueEmail({
                userId: params.userId,
                email: params.email,
                emailType: "payment_reminder",
                subject,
                htmlBody: html,
                metadata: {
                    debtor_name: params.debtorName,
                    creditor_name: params.creditorName,
                    amount: params.amount,
                    group_name: params.groupName,
                },
            });

            return result;
        }
    );
}

/**
 * Queue a group invitation email (non-blocking)
 */
export function notifyGroupInvitation(params: {
    userId: string;
    email: string;
    inviterName: string;
    groupName: string;
    inviteLink: string;
}): void {
    fireAndForget(
        "group_invitation",
        async (): Promise<EmailNotificationResult> => {
            const { subject, html } = generateGroupInvitationHtml({
                inviterName: params.inviterName,
                groupName: params.groupName,
                inviteLink: params.inviteLink,
            });

            const result = await queueEmail({
                userId: params.userId,
                email: params.email,
                emailType: "group_invitation",
                subject,
                htmlBody: html,
                metadata: {
                    inviter_name: params.inviterName,
                    group_name: params.groupName,
                },
            });

            return result;
        }
    );
}

/**
 * Queue a settlement request email (non-blocking)
 */
export function notifySettlementRequest(params: {
    userId: string;
    email: string;
    payerName: string;
    amount: string;
    groupName: string;
    approveLink?: string;
}): void {
    fireAndForget(
        "settlement_request",
        async (): Promise<EmailNotificationResult> => {
            const { subject, html } = generateSettlementRequestHtml({
                payerName: params.payerName,
                amount: params.amount,
                groupName: params.groupName,
                approveLink: params.approveLink,
            });

            const result = await queueEmail({
                userId: params.userId,
                email: params.email,
                emailType: "settlement_request",
                subject,
                htmlBody: html,
                metadata: {
                    payer_name: params.payerName,
                    amount: params.amount,
                    group_name: params.groupName,
                },
            });

            return result;
        }
    );
}

/**
 * Queue a settlement approved email (non-blocking)
 */
export function notifySettlementApproved(params: {
    userId: string;
    email: string;
    recipientName: string;
    approverName: string;
    amount: string;
    groupName: string;
}): void {
    fireAndForget(
        "settlement_approved",
        async (): Promise<EmailNotificationResult> => {
            const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
    <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 32px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">✅ Payment Confirmed!</h1>
        </div>
        <div style="padding: 32px;">
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                Hi ${params.recipientName},
            </p>
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                <strong>${params.approverName}</strong> has confirmed receiving your payment of <strong style="color: #22c55e;">${params.amount}</strong> in <strong>${params.groupName}</strong>.
            </p>
            <div style="background: #dcfce7; border-radius: 12px; padding: 20px; text-align: center;">
                <p style="color: #166534; font-size: 16px; font-weight: 600; margin: 0;">
                    🎉 Settlement Complete!
                </p>
            </div>
        </div>
        <div style="background: #f9fafb; padding: 20px 32px; text-align: center;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                Smart Split • Split expenses with friends
            </p>
        </div>
    </div>
</body>
</html>
            `.trim();

            const result = await queueEmail({
                userId: params.userId,
                email: params.email,
                emailType: "settlement_approved",
                subject: `✅ ${params.approverName} confirmed your ${params.amount} payment`,
                htmlBody: html,
                metadata: {
                    approver_name: params.approverName,
                    amount: params.amount,
                    group_name: params.groupName,
                },
            });

            return result;
        }
    );
}

/**
 * Queue a settlement rejected email (non-blocking)
 */
export function notifySettlementRejected(params: {
    userId: string;
    email: string;
    recipientName: string;
    rejecterName: string;
    amount: string;
    groupName: string;
    reason?: string;
}): void {
    fireAndForget(
        "settlement_rejected",
        async (): Promise<EmailNotificationResult> => {
            const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
    <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 32px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">❌ Settlement Declined</h1>
        </div>
        <div style="padding: 32px;">
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                Hi ${params.recipientName},
            </p>
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                <strong>${params.rejecterName}</strong> has declined your settlement of <strong style="color: #ef4444;">${params.amount}</strong> in <strong>${params.groupName}</strong>.
            </p>
            ${params.reason ? `
            <div style="background: #fef2f2; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
                <p style="color: #991b1b; font-size: 14px; margin: 0;">
                    <strong>Reason:</strong> ${params.reason}
                </p>
            </div>
            ` : ""}
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
                Please contact ${params.rejecterName} to resolve this.
            </p>
        </div>
        <div style="background: #f9fafb; padding: 20px 32px; text-align: center;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                Smart Split • Split expenses with friends
            </p>
        </div>
    </div>
</body>
</html>
            `.trim();

            const result = await queueEmail({
                userId: params.userId,
                email: params.email,
                emailType: "settlement_rejected",
                subject: `❌ ${params.rejecterName} declined your ${params.amount} payment`,
                htmlBody: html,
                metadata: {
                    rejecter_name: params.rejecterName,
                    amount: params.amount,
                    group_name: params.groupName,
                    reason: params.reason,
                },
            });

            return result;
        }
    );
}

/**
 * Queue an expense added notification email (non-blocking)
 */
export function notifyExpenseAdded(params: {
    userId: string;
    email: string;
    recipientName: string;
    addedByName: string;
    expenseDescription: string;
    totalAmount: string;
    yourShare: string;
    groupName: string;
    viewLink?: string;
}): void {
    fireAndForget(
        "expense_added",
        async (): Promise<EmailNotificationResult> => {
            const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
    <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 32px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">📝 New Expense Added</h1>
        </div>
        <div style="padding: 32px;">
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                Hi ${params.recipientName},
            </p>
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                <strong>${params.addedByName}</strong> added a new expense in <strong>${params.groupName}</strong>:
            </p>
            <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <p style="color: #374151; font-size: 18px; font-weight: 600; margin: 0 0 8px;">
                    ${params.expenseDescription}
                </p>
                <p style="color: #6b7280; font-size: 14px; margin: 0 0 12px;">
                    Total: ${params.totalAmount}
                </p>
                <p style="color: #3b82f6; font-size: 20px; font-weight: 700; margin: 0;">
                    Your share: ${params.yourShare}
                </p>
            </div>
            ${params.viewLink ? `
            <a href="${params.viewLink}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                View Details
            </a>
            ` : ""}
        </div>
        <div style="background: #f9fafb; padding: 20px 32px; text-align: center;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                Smart Split • Split expenses with friends
            </p>
        </div>
    </div>
</body>
</html>
            `.trim();

            const result = await queueEmail({
                userId: params.userId,
                email: params.email,
                emailType: "expense_added",
                subject: `📝 ${params.addedByName} added "${params.expenseDescription}" - Your share: ${params.yourShare}`,
                htmlBody: html,
                metadata: {
                    added_by: params.addedByName,
                    description: params.expenseDescription,
                    total: params.totalAmount,
                    share: params.yourShare,
                    group_name: params.groupName,
                },
            });

            return result;
        }
    );
}

// ============================================
// IN-APP NOTIFICATIONS (Non-blocking)
// ============================================

/**
 * Create an in-app notification (non-blocking)
 * Uses dynamic import to avoid circular dependencies
 */
export function createInAppNotification(params: {
    userId: string;
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
    actionUrl?: string;
}): void {
    fireAndForget(
        "in_app_notification",
        async () => {
            // Dynamic import to get Supabase client
            const { createClient } = await import("@/lib/supabase/client");
            const supabase = createClient();

            const { error } = await supabase
                .from("notifications")
                .insert({
                    user_id: params.userId,
                    type: params.type,
                    title: params.title,
                    message: params.message,
                    data: params.data || {},
                    action_url: params.actionUrl || null,
                });

            if (error) {
                throw new Error(`Failed to create notification: ${error.message}`);
            }

            return { created: true };
        }
    );
}

// ============================================
// COMBINED NOTIFICATION (Email + In-App)
// ============================================

interface NotificationParams {
    userId: string;
    email?: string;
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
    actionUrl?: string;
    emailHtml?: string;
    emailSubject?: string;
}

/**
 * Send both email and in-app notification (non-blocking)
 * Both run independently and failures don't affect each other
 */
export function notify(params: NotificationParams): void {
    // In-app notification
    createInAppNotification({
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        data: params.data,
        actionUrl: params.actionUrl,
    });

    // Email notification (if email provided)
    if (params.email && params.emailHtml && params.emailSubject) {
        fireAndForget(
            `email_${params.type}`,
            async () => {
                const result = await queueEmail({
                    userId: params.userId,
                    email: params.email!,
                    emailType: params.type,
                    subject: params.emailSubject!,
                    htmlBody: params.emailHtml!,
                    metadata: params.data,
                });
                return result;
            }
        );
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get recent notification logs (for debugging)
 */
export function getRecentNotificationLogs(): NotificationLog[] {
    return [...notificationLogs];
}

/**
 * Clear notification logs
 */
export function clearNotificationLogs(): void {
    notificationLogs.length = 0;
}

