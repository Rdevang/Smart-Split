/**
 * Email Service for Smart Split Notifications
 * Uses Resend for transactional emails
 * 
 * Setup:
 * 1. npm install resend
 * 2. Add RESEND_API_KEY to .env.local
 * 3. Verify your domain in Resend dashboard (optional but recommended)
 */

import { logger } from "@/lib/logger";

// Conditionally import Resend to avoid build errors if not installed
let Resend: typeof import("resend").Resend | null = null;

async function getResendClient() {
    if (!Resend) {
        try {
            const resendModule = await import("resend");
            Resend = resendModule.Resend;
        } catch {
            logger.warn("Resend not installed. Run: npm install resend");
            return null;
        }
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        logger.warn("RESEND_API_KEY not configured");
        return null;
    }

    return new Resend(apiKey);
}

// Email configuration
const EMAIL_CONFIG = {
    from: process.env.EMAIL_FROM || "Smart Split <notifications@smartsplit.app>",
    replyTo: process.env.EMAIL_REPLY_TO || "support@smartsplit.app",
};

// Email types
export type EmailType =
    | "payment_reminder"
    | "settlement_request"
    | "settlement_approved"
    | "settlement_rejected"
    | "group_invitation"
    | "expense_added"
    | "weekly_summary";

interface SendEmailParams {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    type?: EmailType;
}

/**
 * Send an email using Resend
 * 
 * This function is designed to be error-tolerant:
 * - Never throws exceptions
 * - Returns gracefully on any failure including rate limits
 * - Logs errors but doesn't propagate them
 */
export async function sendEmail(params: SendEmailParams): Promise<{ 
    success: boolean; 
    error?: string; 
    id?: string;
    rateLimited?: boolean;
}> {
    try {
        const resend = await getResendClient();

        if (!resend) {
            logger.info("[Email] Skipping email send - Resend not configured");
            return { success: false, error: "Email service not configured" };
        }

        const { data, error } = await resend.emails.send({
            from: EMAIL_CONFIG.from,
            to: Array.isArray(params.to) ? params.to : [params.to],
            subject: params.subject,
            html: params.html,
            text: params.text,
            replyTo: EMAIL_CONFIG.replyTo,
        });

        if (error) {
            // Check for rate limit errors from Resend
            const errorMessage = error.message?.toLowerCase() || "";
            if (errorMessage.includes("rate") || errorMessage.includes("limit") || 
                errorMessage.includes("too many") || errorMessage.includes("quota")) {
                logger.warn("[Email] Rate limit reached", { error: error.message });
                return { success: false, error: error.message, rateLimited: true };
            }
            
            logger.error("[Email] Send failed", new Error(error.message));
            return { success: false, error: error.message };
        }

        logger.info("[Email] Sent successfully", { id: data?.id });
        return { success: true, id: data?.id };
    } catch (err) {
        // Handle any unexpected errors gracefully
        const error = err instanceof Error ? err : new Error(String(err));
        const errorMessage = error.message;
        
        // Check for rate limit in caught errors
        if (errorMessage.toLowerCase().includes("rate") || 
            errorMessage.toLowerCase().includes("limit")) {
            logger.warn("[Email] Rate limit error caught", { error: errorMessage });
            return { success: false, error: errorMessage, rateLimited: true };
        }
        
        logger.error("[Email] Unexpected error", error);
        return { success: false, error: "Failed to send email" };
    }
}

// ==================== EMAIL TEMPLATES ====================

/**
 * Payment Reminder Email
 */
export async function sendPaymentReminderEmail(params: {
    to: string;
    debtorName: string;
    creditorName: string;
    amount: string;
    groupName: string;
    paymentLink?: string;
}): Promise<{ success: boolean; error?: string }> {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
    <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); padding: 32px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">💸 Payment Reminder</h1>
        </div>
        <div style="padding: 32px;">
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                Hi ${params.debtorName},
            </p>
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                <strong>${params.creditorName}</strong> is requesting payment of <strong style="color: #14b8a6;">${params.amount}</strong> in <strong>${params.groupName}</strong>.
            </p>
            ${params.paymentLink ? `
            <a href="${params.paymentLink}" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                View & Pay Now
            </a>
            ` : ""}
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 24px 0 0;">
                Open Smart Split to settle up!
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

    return sendEmail({
        to: params.to,
        subject: `💸 ${params.creditorName} is requesting ${params.amount}`,
        html,
        type: "payment_reminder",
    });
}

/**
 * Settlement Request Email (Pending Approval)
 */
export async function sendSettlementRequestEmail(params: {
    to: string;
    payerName: string;
    amount: string;
    groupName: string;
    approveLink?: string;
}): Promise<{ success: boolean; error?: string }> {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
    <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 32px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🔔 Settlement Request</h1>
        </div>
        <div style="padding: 32px;">
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                <strong>${params.payerName}</strong> claims they've paid you <strong style="color: #f97316;">${params.amount}</strong> in <strong>${params.groupName}</strong>.
            </p>
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                Please confirm if you've received this payment.
            </p>
            ${params.approveLink ? `
            <a href="${params.approveLink}" style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Review & Approve
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

    return sendEmail({
        to: params.to,
        subject: `🔔 ${params.payerName} sent you ${params.amount} - Please confirm`,
        html,
        type: "settlement_request",
    });
}

/**
 * Group Invitation Email
 */
export async function sendGroupInvitationEmail(params: {
    to: string;
    inviterName: string;
    groupName: string;
    inviteLink: string;
}): Promise<{ success: boolean; error?: string }> {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
    <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 32px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🎉 Group Invitation</h1>
        </div>
        <div style="padding: 32px;">
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                <strong>${params.inviterName}</strong> has invited you to join <strong style="color: #8b5cf6;">${params.groupName}</strong> on Smart Split!
            </p>
            <a href="${params.inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Accept Invitation
            </a>
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 24px 0 0;">
                Start splitting expenses with your friends!
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

    return sendEmail({
        to: params.to,
        subject: `🎉 ${params.inviterName} invited you to ${params.groupName}`,
        html,
        type: "group_invitation",
    });
}

/**
 * Expense Added Notification Email
 */
export async function sendExpenseAddedEmail(params: {
    to: string;
    recipientName: string;
    addedByName: string;
    expenseDescription: string;
    totalAmount: string;
    yourShare: string;
    groupName: string;
    viewLink?: string;
}): Promise<{ success: boolean; error?: string }> {
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

    return sendEmail({
        to: params.to,
        subject: `📝 ${params.addedByName} added "${params.expenseDescription}" - Your share: ${params.yourShare}`,
        html,
        type: "expense_added",
    });
}

/**
 * Settlement Approved Email
 */
export async function sendSettlementApprovedEmail(params: {
    to: string;
    recipientName: string;
    approverName: string;
    amount: string;
    groupName: string;
}): Promise<{ success: boolean; error?: string }> {
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
                Great news! <strong>${params.approverName}</strong> has confirmed receiving your payment of <strong style="color: #22c55e;">${params.amount}</strong> in <strong>${params.groupName}</strong>.
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

    return sendEmail({
        to: params.to,
        subject: `✅ ${params.approverName} confirmed your ${params.amount} payment`,
        html,
        type: "settlement_approved",
    });
}

/**
 * Settlement Rejected Email
 */
export async function sendSettlementRejectedEmail(params: {
    to: string;
    recipientName: string;
    rejecterName: string;
    amount: string;
    groupName: string;
    reason?: string;
}): Promise<{ success: boolean; error?: string }> {
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
                Please contact ${params.rejecterName} to resolve this issue or try submitting the payment again.
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

    return sendEmail({
        to: params.to,
        subject: `❌ ${params.rejecterName} declined your ${params.amount} payment`,
        html,
        type: "settlement_rejected",
    });
}

// ==================== HTML GENERATORS FOR QUEUE SYSTEM ====================

/**
 * Generate payment reminder HTML (for queue system)
 */
export function generatePaymentReminderHtml(params: {
    debtorName: string;
    creditorName: string;
    amount: string;
    groupName: string;
    paymentLink?: string;
}): { subject: string; html: string } {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
    <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); padding: 32px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">💸 Payment Reminder</h1>
        </div>
        <div style="padding: 32px;">
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                Hi ${params.debtorName},
            </p>
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                <strong>${params.creditorName}</strong> is requesting payment of <strong style="color: #14b8a6;">${params.amount}</strong> in <strong>${params.groupName}</strong>.
            </p>
            ${params.paymentLink ? `
            <a href="${params.paymentLink}" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                View & Pay Now
            </a>
            ` : ""}
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 24px 0 0;">
                Open Smart Split to settle up!
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

    return {
        subject: `💸 ${params.creditorName} is requesting ${params.amount}`,
        html,
    };
}

/**
 * Generate group invitation HTML (for queue system)
 */
export function generateGroupInvitationHtml(params: {
    inviterName: string;
    groupName: string;
    inviteLink: string;
}): { subject: string; html: string } {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
    <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 32px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🎉 Group Invitation</h1>
        </div>
        <div style="padding: 32px;">
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                <strong>${params.inviterName}</strong> has invited you to join <strong style="color: #8b5cf6;">${params.groupName}</strong> on Smart Split!
            </p>
            <a href="${params.inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Accept Invitation
            </a>
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 24px 0 0;">
                Start splitting expenses with your friends!
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

    return {
        subject: `🎉 ${params.inviterName} invited you to ${params.groupName}`,
        html,
    };
}

/**
 * Generate settlement request HTML (for queue system)
 */
export function generateSettlementRequestHtml(params: {
    payerName: string;
    amount: string;
    groupName: string;
    approveLink?: string;
}): { subject: string; html: string } {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
    <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 32px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🔔 Settlement Request</h1>
        </div>
        <div style="padding: 32px;">
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                <strong>${params.payerName}</strong> claims they've paid you <strong style="color: #f97316;">${params.amount}</strong> in <strong>${params.groupName}</strong>.
            </p>
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                Please confirm if you've received this payment.
            </p>
            ${params.approveLink ? `
            <a href="${params.approveLink}" style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Review & Approve
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

    return {
        subject: `🔔 ${params.payerName} sent you ${params.amount} - Please confirm`,
        html,
    };
}

