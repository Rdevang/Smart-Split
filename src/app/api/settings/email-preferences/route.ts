/**
 * Email Preferences API
 * 
 * GET /api/settings/email-preferences - Get user's email preferences
 * POST /api/settings/email-preferences - Update user's email preferences
 */

import { z } from "zod";
import { createRoute, withAuth, withValidation, ApiResponse, ApiError, type AuthContext, type ValidatedContext } from "@/lib/api";
import { log } from "@/lib/console-logger";

// Default preferences for new users
const DEFAULT_PREFERENCES = {
    payment_reminders: true,
    settlement_requests: true,
    settlement_updates: true,
    group_invitations: true,
    expense_added: false,
    weekly_digest: true,
};

const UpdatePreferencesSchema = z.object({
    userId: z.union([z.literal("current"), z.string().uuid()]).optional(),
    preferences: z.object({
        payment_reminders: z.boolean().optional(),
        settlement_requests: z.boolean().optional(),
        settlement_updates: z.boolean().optional(),
        group_invitations: z.boolean().optional(),
        expense_added: z.boolean().optional(),
        weekly_digest: z.boolean().optional(),
    }),
});

export const GET = createRoute()
    .use(withAuth())
    .handler(async (ctx) => {
        const { user, supabase } = ctx as AuthContext;
        const { data: profile, error } = await supabase
            .from("profiles")
            .select("email_preferences")
            .eq("id", user.id)
            .single();

        if (error) {
            log.error("Settings", "Email preferences fetch failed", error);
            return ApiError.internal("Failed to fetch preferences");
        }

        return ApiResponse.success({
            preferences: profile?.email_preferences || DEFAULT_PREFERENCES,
        });
    });

// Combined context type for POST
type UpdatePreferencesContext = AuthContext & ValidatedContext<z.infer<typeof UpdatePreferencesSchema>>;

export const POST = createRoute()
    .use(withAuth())
    .use(withValidation(UpdatePreferencesSchema))
    .handler(async (ctx) => {
        const { user, validated, supabase } = ctx as unknown as UpdatePreferencesContext;
        const { userId, preferences } = validated;

        // Use authenticated user's ID if "current" is passed or not provided
        const targetUserId = !userId || userId === "current" ? user.id : userId;

        // Verify user can only update their own preferences
        if (targetUserId !== user.id) {
            return ApiError.forbidden("You can only update your own preferences");
        }

        // Build sanitized preferences (only allow valid keys)
        const validKeys = [
            "payment_reminders",
            "settlement_requests",
            "settlement_updates",
            "group_invitations",
            "expense_added",
            "weekly_digest",
        ] as const;

        const sanitizedPreferences: Record<string, boolean> = {};
        for (const key of validKeys) {
            sanitizedPreferences[key] = Boolean(preferences[key]);
        }

        // Update preferences
        const { error } = await supabase
            .from("profiles")
            .update({ email_preferences: sanitizedPreferences })
            .eq("id", targetUserId);

        if (error) {
            log.error("Settings", "Email preferences update failed", error);
            return ApiError.internal("Failed to update preferences");
        }

        return ApiResponse.success({ success: true });
    });
