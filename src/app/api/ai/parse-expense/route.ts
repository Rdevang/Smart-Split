/**
 * AI Expense Parser API
 * 
 * POST /api/ai/parse-expense - Parse expense from natural language
 * GET /api/ai/parse-expense?action=check-usage - Check AI usage limits
 * GET /api/ai/parse-expense?description=xxx - Suggest category
 */

import { z } from "zod";
import { createRoute, withAuth, withValidation, withQueryValidation, ApiResponse, ApiError } from "@/lib/api";
import { parseExpenseFromText, suggestCategory } from "@/services/ai";
import { checkAIUsage, incrementAIUsage } from "@/lib/ai-rate-limit";
import { aiLog } from "@/lib/console-logger";

// Schemas
const ParseExpenseSchema = z.object({
    text: z.string().min(1, "Text is required"),
    groupId: z.string().uuid().optional(),
});

const CategoryQuerySchema = z.object({
    action: z.enum(["check-usage"]).optional(),
    description: z.string().optional(),
});

export const POST = createRoute()
    .use(withAuth())
    .use(withValidation(ParseExpenseSchema))
    .handler(async (ctx) => {
        const { text, groupId } = ctx.validated;

        // Check AI usage limit
        const usage = await checkAIUsage(ctx.user.id);
        if (!usage.allowed) {
            const hoursUntilReset = Math.ceil((usage.resetAt.getTime() - Date.now()) / (1000 * 60 * 60));
            return ApiError.rateLimited(hoursUntilReset * 3600);
        }

        try {
            // Get group members if groupId provided
            let groupMembers: string[] = [];
            if (groupId) {
                const { data: members } = await ctx.supabase
                    .from("group_members")
                    .select(`
                        user_id,
                        placeholder_id,
                        profiles!group_members_user_id_fkey(full_name),
                        placeholder_members(name)
                    `)
                    .eq("group_id", groupId);

                if (members) {
                    groupMembers = members
                        .map((m) => {
                            const profile = m.profiles as unknown as { full_name: string | null } | null;
                            const placeholder = m.placeholder_members as unknown as { name: string } | null;
                            return profile?.full_name || placeholder?.name || null;
                        })
                        .filter((name): name is string => name !== null);
                }
            }

            // Parse the expense text
            const parsedExpense = await parseExpenseFromText(text, groupMembers);

            // Increment usage count after successful parse
            await incrementAIUsage(ctx.user.id);

            // Get updated usage for response
            const updatedUsage = await checkAIUsage(ctx.user.id);

            return ApiResponse.success({
                success: true,
                expense: parsedExpense,
                usage: {
                    used: updatedUsage.used,
                    limit: updatedUsage.limit,
                    remaining: updatedUsage.remaining,
                    resetAt: updatedUsage.resetAt.toISOString(),
                },
            });
        } catch (error) {
            aiLog.error("Parse expense failed", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            return ApiError.internal(`Failed to parse expense: ${errorMessage}`);
        }
    });

export const GET = createRoute()
    .use(withAuth())
    .use(withQueryValidation(CategoryQuerySchema))
    .handler(async (ctx) => {
        const { action, description } = ctx.query;

        // Check usage endpoint
        if (action === "check-usage") {
            const usage = await checkAIUsage(ctx.user.id);
            return ApiResponse.success({
                success: true,
                usage: {
                    used: usage.used,
                    limit: usage.limit,
                    remaining: usage.remaining,
                    allowed: usage.allowed,
                    resetAt: usage.resetAt.toISOString(),
                },
            });
        }

        // Category suggestion endpoint
        if (!description) {
            return ApiError.badRequest("Description is required for category suggestion");
        }

        try {
            const category = await suggestCategory(description);
            return ApiResponse.success({
                success: true,
                category,
            });
        } catch (error) {
            aiLog.error("Category suggestion failed", error);
            return ApiError.internal("Failed to process request");
        }
    });
