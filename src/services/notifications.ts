import { createClient } from "@/lib/supabase/client";

export interface Notification {
    id: string;
    user_id: string;
    type: string;
    title: string;
    message: string | null;
    data: Record<string, unknown>;
    is_read: boolean;
    action_url: string | null;
    created_at: string;
    read_at: string | null;
}

export interface GroupInvitation {
    id: string;
    group_id: string;
    invited_user_id: string;
    invited_by: string;
    status: "pending" | "accepted" | "declined";
    created_at: string;
    group?: {
        id: string;
        name: string;
        description: string | null;
    };
    inviter?: {
        id: string;
        full_name: string | null;
        email: string;
        avatar_url: string | null;
    };
}

export const notificationsService = {
    /**
     * Get all notifications for a user
     */
    async getNotifications(userId: string, limit = 20): Promise<Notification[]> {
        const supabase = createClient();

        const { data, error } = await supabase
            .from("notifications")
            .select("id, user_id, type, title, message, data, is_read, action_url, created_at, read_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(limit);

        if (error) {
            console.error("Error fetching notifications:", error);
            return [];
        }

        return data || [];
    },

    /**
     * Get unread notification count
     */
    async getUnreadCount(userId: string): Promise<number> {
        const supabase = createClient();

        const { count, error } = await supabase
            .from("notifications")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("is_read", false);

        if (error) {
            console.error("Error fetching unread count:", error);
            return 0;
        }

        return count || 0;
    },

    /**
     * Mark a notification as read
     */
    async markAsRead(notificationId: string): Promise<boolean> {
        const supabase = createClient();

        const { error } = await supabase
            .from("notifications")
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq("id", notificationId);

        return !error;
    },

    /**
     * Mark all notifications as read
     */
    async markAllAsRead(userId: string): Promise<boolean> {
        const supabase = createClient();

        const { error } = await supabase
            .from("notifications")
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq("user_id", userId)
            .eq("is_read", false);

        return !error;
    },

    /**
     * Delete a notification
     */
    async deleteNotification(notificationId: string): Promise<boolean> {
        const supabase = createClient();

        const { error } = await supabase
            .from("notifications")
            .delete()
            .eq("id", notificationId);

        return !error;
    },

    /**
     * Delete all read notifications for a user
     */
    async deleteAllRead(userId: string): Promise<boolean> {
        const supabase = createClient();

        const { error } = await supabase
            .from("notifications")
            .delete()
            .eq("user_id", userId)
            .eq("is_read", true);

        return !error;
    },

    /**
     * Create a notification
     */
    async createNotification(notification: {
        user_id: string;
        type: string;
        title: string;
        message?: string;
        data?: Record<string, unknown>;
        action_url?: string;
    }): Promise<boolean> {
        const supabase = createClient();

        const { error } = await supabase.from("notifications").insert({
            user_id: notification.user_id,
            type: notification.type,
            title: notification.title,
            message: notification.message || null,
            data: notification.data || {},
            action_url: notification.action_url || null,
        });

        if (error) {
            console.error("Error creating notification:", error);
            return false;
        }

        return true;
    },

    // ============ Group Invitations ============

    /**
     * Get pending invitations for a user
     */
    async getPendingInvitations(userId: string): Promise<GroupInvitation[]> {
        const supabase = createClient();

        const { data, error } = await supabase
            .from("group_invitations")
            .select(`
                *,
                group:groups (id, name, description),
                inviter:profiles!group_invitations_invited_by_fkey (id, full_name, email, avatar_url)
            `)
            .eq("invited_user_id", userId)
            .eq("status", "pending")
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error fetching invitations:", error);
            return [];
        }

        return (data || []).map((item) => ({
            ...item,
            group: Array.isArray(item.group) ? item.group[0] : item.group,
            inviter: Array.isArray(item.inviter) ? item.inviter[0] : item.inviter,
        }));
    },

    /**
     * Send a group invitation
     */
    async sendGroupInvitation(
        groupId: string,
        invitedUserId: string,
        invitedBy: string,
        groupName: string,
        inviterName: string
    ): Promise<{ success: boolean; error?: string }> {
        const supabase = createClient();

        // Check if invitation already exists
        const { data: existing } = await supabase
            .from("group_invitations")
            .select("id, status")
            .eq("group_id", groupId)
            .eq("invited_user_id", invitedUserId)
            .single();

        if (existing) {
            if (existing.status === "pending") {
                return { success: false, error: "Invitation already sent" };
            }
            if (existing.status === "declined") {
                // Update existing declined invitation to pending
                await supabase
                    .from("group_invitations")
                    .update({ status: "pending", responded_at: null })
                    .eq("id", existing.id);
            }
        } else {
            // Create new invitation
            const { error } = await supabase.from("group_invitations").insert({
                group_id: groupId,
                invited_user_id: invitedUserId,
                invited_by: invitedBy,
            });

            if (error) {
                return { success: false, error: error.message };
            }
        }

        // Create notification
        await this.createNotification({
            user_id: invitedUserId,
            type: "group_invite",
            title: "Group Invitation",
            message: `${inviterName} invited you to join "${groupName}"`,
            data: { group_id: groupId, invited_by: invitedBy },
            action_url: `/groups`,
        });

        return { success: true };
    },

    /**
     * Accept a group invitation
     */
    async acceptInvitation(
        invitationId: string,
        userId: string
    ): Promise<{ success: boolean; error?: string }> {
        const supabase = createClient();

        // Get invitation details
        const { data: invitation } = await supabase
            .from("group_invitations")
            .select("group_id, invited_by")
            .eq("id", invitationId)
            .eq("invited_user_id", userId)
            .single();

        if (!invitation) {
            return { success: false, error: "Invitation not found" };
        }

        // Update invitation status
        const { error: updateError } = await supabase
            .from("group_invitations")
            .update({ status: "accepted", responded_at: new Date().toISOString() })
            .eq("id", invitationId);

        if (updateError) {
            return { success: false, error: updateError.message };
        }

        // Add user to group
        const { error: addError } = await supabase.from("group_members").insert({
            group_id: invitation.group_id,
            user_id: userId,
            role: "member",
        });

        if (addError) {
            // If already a member, that's fine
            if (!addError.message.includes("duplicate")) {
                return { success: false, error: addError.message };
            }
        }

        return { success: true };
    },

    /**
     * Decline a group invitation
     */
    async declineInvitation(
        invitationId: string,
        userId: string
    ): Promise<{ success: boolean; error?: string }> {
        const supabase = createClient();

        const { error } = await supabase
            .from("group_invitations")
            .update({ status: "declined", responded_at: new Date().toISOString() })
            .eq("id", invitationId)
            .eq("invited_user_id", userId);

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true };
    },
};

