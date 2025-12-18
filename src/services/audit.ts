/**
 * Audit Logging Service
 * 
 * Provides access to audit logs for tracking sensitive operations.
 * Audit logs are automatically created by database triggers.
 */

import { createClient } from "@/lib/supabase/client";

export interface AuditLog {
    id: string;
    user_id: string | null;
    user_email: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    group_id: string | null;
    details: Record<string, unknown>;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
}

export interface AuditLogFilters {
    userId?: string;
    groupId?: string;
    action?: string;
    entityType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
}

export const auditService = {
    /**
     * Get audit logs for the current user
     */
    async getMyAuditLogs(filters?: AuditLogFilters): Promise<{
        logs: AuditLog[];
        count: number;
        error?: string;
    }> {
        const supabase = createClient();
        
        let query = supabase
            .from("audit_logs")
            .select("*", { count: "exact" })
            .order("created_at", { ascending: false });
        
        if (filters?.action) {
            query = query.eq("action", filters.action);
        }
        
        if (filters?.entityType) {
            query = query.eq("entity_type", filters.entityType);
        }
        
        if (filters?.startDate) {
            query = query.gte("created_at", filters.startDate.toISOString());
        }
        
        if (filters?.endDate) {
            query = query.lte("created_at", filters.endDate.toISOString());
        }
        
        const limit = filters?.limit || 50;
        const offset = filters?.offset || 0;
        query = query.range(offset, offset + limit - 1);
        
        const { data, count, error } = await query;
        
        if (error) {
            return { logs: [], count: 0, error: error.message };
        }
        
        return { logs: data || [], count: count || 0 };
    },
    
    /**
     * Get audit logs for a specific group (admin only)
     */
    async getGroupAuditLogs(
        groupId: string,
        filters?: Omit<AuditLogFilters, "groupId">
    ): Promise<{
        logs: AuditLog[];
        count: number;
        error?: string;
    }> {
        const supabase = createClient();
        
        let query = supabase
            .from("audit_logs")
            .select("*", { count: "exact" })
            .eq("group_id", groupId)
            .order("created_at", { ascending: false });
        
        if (filters?.action) {
            query = query.eq("action", filters.action);
        }
        
        if (filters?.entityType) {
            query = query.eq("entity_type", filters.entityType);
        }
        
        if (filters?.startDate) {
            query = query.gte("created_at", filters.startDate.toISOString());
        }
        
        if (filters?.endDate) {
            query = query.lte("created_at", filters.endDate.toISOString());
        }
        
        const limit = filters?.limit || 50;
        const offset = filters?.offset || 0;
        query = query.range(offset, offset + limit - 1);
        
        const { data, count, error } = await query;
        
        if (error) {
            return { logs: [], count: 0, error: error.message };
        }
        
        return { logs: data || [], count: count || 0 };
    },
    
    /**
     * Create a manual audit log entry
     * Use this for actions that aren't captured by database triggers
     * (e.g., login attempts, password changes)
     */
    async createAuditLog(params: {
        action: string;
        entityType: string;
        entityId?: string;
        groupId?: string;
        details?: Record<string, unknown>;
    }): Promise<{ success: boolean; auditId?: string; error?: string }> {
        const supabase = createClient();
        
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            return { success: false, error: "Not authenticated" };
        }
        
        const { data, error } = await supabase.rpc("create_audit_log", {
            p_user_id: user.id,
            p_user_email: user.email || null,
            p_action: params.action,
            p_entity_type: params.entityType,
            p_entity_id: params.entityId || null,
            p_group_id: params.groupId || null,
            p_details: params.details || {},
            p_ip_address: null, // Would need to pass from server
            p_user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        });
        
        if (error) {
            return { success: false, error: error.message };
        }
        
        return { success: true, auditId: data };
    },
    
    /**
     * Get available audit action types
     */
    getActionTypes(): string[] {
        return [
            "group_created",
            "group_updated",
            "group_deleted",
            "group_member_added",
            "group_member_removed",
            "group_admin_promoted",
            "group_admin_demoted",
            "expense_created",
            "expense_updated",
            "expense_deleted",
            "settlement_created",
            "settlement_approved",
            "settlement_rejected",
            "user_profile_updated",
            "user_avatar_changed",
            "login_success",
            "login_failed",
            "password_changed",
            "password_reset_requested",
            "invite_code_regenerated",
            "invite_accepted",
            "invite_rejected",
        ];
    },
    
    /**
     * Get entity types
     */
    getEntityTypes(): string[] {
        return ["group", "expense", "settlement", "user", "member"];
    },
};

