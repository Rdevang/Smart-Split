/**
 * GET /api/groups/preview
 * 
 * Preview group information by invite code.
 * Returns group details and whether user is already a member.
 */

import { z } from "zod";
import { createRoute, withAuth, withQueryValidation, ApiResponse, ApiError, type AuthContext, type QueryValidatedContext } from "@/lib/api";

const PreviewQuerySchema = z.object({
    code: z.string().min(1, "Invite code is required"),
});

// Combined context type
type PreviewContext = AuthContext & QueryValidatedContext<z.infer<typeof PreviewQuerySchema>>;

export const GET = createRoute()
    .use(withAuth())
    .use(withQueryValidation(PreviewQuerySchema))
    .handler(async (ctx) => {
        const { user, query, supabase } = ctx as unknown as PreviewContext;
        const { code } = query;

        // Find group by invite code
        const { data: group, error } = await supabase
            .from("groups")
            .select(`
                id, 
                name, 
                description,
                group_members (id, user_id)
            `)
            .eq("invite_code", code.toUpperCase().trim())
            .single();

        if (error || !group) {
            return ApiError.notFound("Invalid invite code. Please check and try again.");
        }

        // Check if user is already a member
        const alreadyMember = group.group_members?.some(
            (member: { user_id: string | null }) => member.user_id === user.id
        );

        return ApiResponse.success({
            group: {
                id: group.id,
                name: group.name,
                description: group.description,
                member_count: group.group_members?.length || 0,
            },
            alreadyMember,
        });
    });
