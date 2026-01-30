/**
 * Weekly Digest Email Generator
 * 
 * Generates personalized weekly summaries for users including:
 * - Total spending across all groups
 * - Outstanding balances (owed/owing)
 * - Recent activity highlights
 * - Top spending categories
 */

import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/currency";
import { queueEmail } from "./email-queue";
import { log } from "@/lib/console-logger";

interface UserDigestData {
    userId: string;
    email: string;
    fullName: string;
    currency: string;
    totalOwed: number;      // Money owed TO user
    totalOwing: number;     // Money user OWES
    netBalance: number;
    groupCount: number;
    expenseCount: number;
    totalSpent: number;
    topCategories: { category: string; amount: number }[];
    pendingSettlements: number;
}

/**
 * Generate weekly digest for a single user
 */
async function generateUserDigest(userId: string): Promise<UserDigestData | null> {
    const supabase = await createClient();

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Get user profile
    const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name, currency")
        .eq("id", userId)
        .single();

    if (!profile?.email) return null;

    // Get user's groups
    const { data: memberships } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", userId);

    const groupIds = memberships?.map(m => m.group_id) || [];
    if (groupIds.length === 0) return null;

    // Get balances across all groups
    let totalOwed = 0;
    let totalOwing = 0;

    for (const groupId of groupIds) {
        const { data: balances } = await supabase.rpc("get_group_balances", {
            group_uuid: groupId,
        });

        const userBalance = balances?.find((b: { user_id: string }) => b.user_id === userId);
        if (userBalance) {
            if (userBalance.balance > 0) {
                totalOwed += userBalance.balance;
            } else {
                totalOwing += Math.abs(userBalance.balance);
            }
        }
    }

    // Get expenses from last week
    const { data: expenses } = await supabase
        .from("expenses")
        .select("amount, category, paid_by")
        .in("group_id", groupIds)
        .gte("created_at", weekAgo.toISOString());

    // Calculate spending by category
    const categorySpending = new Map<string, number>();
    let totalSpent = 0;
    let userExpenseCount = 0;

    for (const expense of expenses || []) {
        const category = expense.category || "other";
        categorySpending.set(category, (categorySpending.get(category) || 0) + expense.amount);
        totalSpent += expense.amount;

        if (expense.paid_by === userId) {
            userExpenseCount++;
        }
    }

    // Top 3 categories
    const topCategories = Array.from(categorySpending.entries())
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3);

    // Get pending settlements count
    const { count: pendingCount } = await supabase
        .from("settlements")
        .select("id", { count: "exact", head: true })
        .eq("to_user", userId)
        .eq("status", "pending");

    return {
        userId,
        email: profile.email,
        fullName: profile.full_name || "there",
        currency: profile.currency || "USD",
        totalOwed,
        totalOwing,
        netBalance: totalOwed - totalOwing,
        groupCount: groupIds.length,
        expenseCount: userExpenseCount,
        totalSpent,
        topCategories,
        pendingSettlements: pendingCount || 0,
    };
}

/**
 * Generate HTML for weekly digest email
 */
function generateDigestHtml(data: UserDigestData): string {
    const categoryEmojis: Record<string, string> = {
        food: "🍔",
        transport: "🚗",
        entertainment: "🎬",
        utilities: "💡",
        rent: "🏠",
        shopping: "🛍️",
        travel: "✈️",
        healthcare: "🏥",
        groceries: "🛒",
        other: "📦",
    };

    const categoryLabels: Record<string, string> = {
        food: "Food & Dining",
        transport: "Transport",
        entertainment: "Entertainment",
        utilities: "Utilities",
        rent: "Rent",
        shopping: "Shopping",
        travel: "Travel",
        healthcare: "Healthcare",
        groceries: "Groceries",
        other: "Other",
    };

    const netBalanceColor = data.netBalance >= 0 ? "#22c55e" : "#ef4444";
    const netBalanceText = data.netBalance >= 0
        ? `+${formatCurrency(data.netBalance, data.currency)}`
        : `-${formatCurrency(Math.abs(data.netBalance), data.currency)}`;

    const categoriesHtml = data.topCategories.map(cat => `
        <div style="display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid #f3f4f6;">
            <span style="font-size: 24px;">${categoryEmojis[cat.category] || "📦"}</span>
            <div style="flex: 1;">
                <p style="margin: 0; font-weight: 500; color: #374151;">
                    ${categoryLabels[cat.category] || cat.category}
                </p>
            </div>
            <span style="font-weight: 600; color: #374151;">
                ${formatCurrency(cat.amount, data.currency)}
            </span>
        </div>
    `).join("");

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
    <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); padding: 32px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">📊 Your Weekly Summary</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">
                Smart Split • Week in Review
            </p>
        </div>
        
        <!-- Greeting -->
        <div style="padding: 32px 32px 0;">
            <p style="color: #374151; font-size: 16px; margin: 0 0 24px;">
                Hi ${data.fullName.split(" ")[0]}! Here's your expense summary for this week.
            </p>
        </div>
        
        <!-- Balance Card -->
        <div style="padding: 0 32px;">
            <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 16px; padding: 24px; margin-bottom: 24px;">
                <p style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 8px;">
                    Net Balance
                </p>
                <p style="color: ${netBalanceColor}; font-size: 36px; font-weight: 700; margin: 0;">
                    ${netBalanceText}
                </p>
                
                <div style="display: flex; gap: 24px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                    <div>
                        <p style="color: #6b7280; font-size: 12px; margin: 0 0 4px;">You are owed</p>
                        <p style="color: #22c55e; font-size: 18px; font-weight: 600; margin: 0;">
                            ${formatCurrency(data.totalOwed, data.currency)}
                        </p>
                    </div>
                    <div>
                        <p style="color: #6b7280; font-size: 12px; margin: 0 0 4px;">You owe</p>
                        <p style="color: #ef4444; font-size: 18px; font-weight: 600; margin: 0;">
                            ${formatCurrency(data.totalOwing, data.currency)}
                        </p>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Stats Grid -->
        <div style="padding: 0 32px;">
            <div style="display: flex; gap: 16px; margin-bottom: 24px;">
                <div style="flex: 1; background: #f3f4f6; border-radius: 12px; padding: 16px; text-align: center;">
                    <p style="color: #6b7280; font-size: 12px; margin: 0 0 4px;">Groups</p>
                    <p style="color: #374151; font-size: 24px; font-weight: 700; margin: 0;">${data.groupCount}</p>
                </div>
                <div style="flex: 1; background: #f3f4f6; border-radius: 12px; padding: 16px; text-align: center;">
                    <p style="color: #6b7280; font-size: 12px; margin: 0 0 4px;">Expenses</p>
                    <p style="color: #374151; font-size: 24px; font-weight: 700; margin: 0;">${data.expenseCount}</p>
                </div>
                <div style="flex: 1; background: #f3f4f6; border-radius: 12px; padding: 16px; text-align: center;">
                    <p style="color: #6b7280; font-size: 12px; margin: 0 0 4px;">Total Spent</p>
                    <p style="color: #374151; font-size: 16px; font-weight: 700; margin: 0;">
                        ${formatCurrency(data.totalSpent, data.currency)}
                    </p>
                </div>
            </div>
        </div>
        
        ${data.topCategories.length > 0 ? `
        <!-- Top Categories -->
        <div style="padding: 0 32px 24px;">
            <h3 style="color: #374151; font-size: 14px; font-weight: 600; margin: 0 0 12px;">
                Top Spending Categories
            </h3>
            <div style="background: #f9fafb; border-radius: 12px; padding: 4px 16px;">
                ${categoriesHtml}
            </div>
        </div>
        ` : ""}
        
        ${data.pendingSettlements > 0 ? `
        <!-- Pending Settlements Alert -->
        <div style="padding: 0 32px 24px;">
            <div style="background: #fef3c7; border-radius: 12px; padding: 16px; display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 24px;">⏳</span>
                <div>
                    <p style="color: #92400e; font-weight: 600; margin: 0;">
                        ${data.pendingSettlements} pending settlement${data.pendingSettlements > 1 ? "s" : ""}
                    </p>
                    <p style="color: #a16207; font-size: 13px; margin: 4px 0 0;">
                        Waiting for your approval
                    </p>
                </div>
            </div>
        </div>
        ` : ""}
        
        <!-- CTA -->
        <div style="padding: 0 32px 32px; text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_SITE_URL || "https://smartsplit.app"}/dashboard" 
               style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                View Full Dashboard
            </a>
        </div>
        
        <!-- Footer -->
        <div style="background: #f9fafb; padding: 24px 32px; text-align: center;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0 0 8px;">
                Smart Split • Split expenses with friends
            </p>
            <p style="color: #9ca3af; font-size: 11px; margin: 0;">
                <a href="${process.env.NEXT_PUBLIC_SITE_URL || "https://smartsplit.app"}/settings/profile" 
                   style="color: #6b7280; text-decoration: underline;">
                    Manage email preferences
                </a>
            </p>
        </div>
    </div>
</body>
</html>
    `.trim();
}

/**
 * Queue weekly digest for a single user
 */
export async function queueWeeklyDigestForUser(userId: string): Promise<boolean> {
    try {
        const digestData = await generateUserDigest(userId);

        if (!digestData) {
            log.debug("Digest", "No data for user, skipping");
            return false;
        }

        // Skip if no activity (no balances and no expenses)
        if (digestData.totalOwed === 0 && digestData.totalOwing === 0 && digestData.expenseCount === 0) {
            log.debug("Digest", "No activity for user, skipping");
            return false;
        }

        const html = generateDigestHtml(digestData);

        // Generate unique key for this week's digest
        const weekNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
        const idempotencyKey = `digest-${userId}-week-${weekNumber}`;

        const result = await queueEmail({
            userId: digestData.userId,
            email: digestData.email,
            emailType: "weekly_digest",
            subject: `📊 Your Smart Split Weekly Summary`,
            htmlBody: html,
            idempotencyKey,
        });

        if (result.queued) {
            // Update last digest sent timestamp
            const supabase = await createClient();
            await supabase
                .from("profiles")
                .update({ last_digest_sent_at: new Date().toISOString() })
                .eq("id", userId);
        }

        return result.queued;
    } catch (error) {
        log.error("Digest", "Failed to queue digest for user", error);
        return false;
    }
}

/**
 * Queue weekly digests for all eligible users
 * Called by cron job (e.g., every Sunday at 9am)
 */
export async function queueAllWeeklyDigests(): Promise<{
    queued: number;
    skipped: number;
    errors: number;
}> {
    const supabase = await createClient();

    // Get users who should receive digest
    const { data: users, error } = await supabase.rpc("get_users_for_weekly_digest");

    if (error || !users) {
        log.error("Digest", "Failed to get users for digest", error);
        return { queued: 0, skipped: 0, errors: 1 };
    }

    log.info("Digest", "Processing users for weekly digest", { count: users.length });

    let queued = 0;
    let skipped = 0;
    const errors = 0;

    // Process in batches of 10 to avoid overwhelming the system
    const BATCH_SIZE = 10;
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
        const batch = users.slice(i, i + BATCH_SIZE);

        const results = await Promise.all(
            batch.map((user: { user_id: string }) => queueWeeklyDigestForUser(user.user_id))
        );

        for (const success of results) {
            if (success) queued++;
            else skipped++;
        }

        // Small delay between batches
        if (i + BATCH_SIZE < users.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    log.info("Digest", "Digest processing complete", { queued, skipped, errors });

    return { queued, skipped, errors };
}

