import { createClient } from "@/lib/supabase/server";

export type UserRole = "user" | "admin" | "site_admin";

export interface AdminUser {
    id: string;
    email: string;
    full_name: string | null;
    role: UserRole;
}

/**
 * Check if the current user is an admin or site_admin
 */
export async function isAdmin(): Promise<boolean> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return false;
    
    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
    
    return profile?.role === "admin" || profile?.role === "site_admin";
}

/**
 * Check if the current user is a site_admin
 */
export async function isSiteAdmin(): Promise<boolean> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return false;
    
    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
    
    return profile?.role === "site_admin";
}

/**
 * Get the current user's role
 */
export async function getUserRole(): Promise<UserRole | null> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return null;
    
    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
    
    return (profile?.role as UserRole) || "user";
}

/**
 * Get admin user details (for admin pages)
 */
export async function getAdminUser(): Promise<AdminUser | null> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return null;
    
    const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", user.id)
        .single();
    
    if (!profile || (profile.role !== "admin" && profile.role !== "site_admin")) {
        return null;
    }
    
    return {
        id: profile.id,
        email: user.email!,
        full_name: profile.full_name,
        role: profile.role as UserRole,
    };
}
