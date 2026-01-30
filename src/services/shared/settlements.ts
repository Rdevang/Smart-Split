/**
 * Shared Settlement Logic
 * 
 * This module contains settlement-related functions that can be used
 * by both client-side (browser) and server-side services.
 * 
 * IMPORTANT: Pass the Supabase client as a parameter to allow both
 * createClient() (browser) and createClient() (server) to work.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface SettlementWithNames {
    id: string;
    from_user: string;
    from_user_name: string;
    to_user: string;
    to_user_name: string;
    amount: number;
    settled_at: string;
    note: string | null;
    status?: string;
}

type ProfileData = { full_name: string | null; email: string };
type PlaceholderData = { id: string; name: string };

interface RawSettlement {
    id: string;
    from_user: string | null;
    to_user: string | null;
    from_placeholder_id: string | null;
    to_placeholder_id: string | null;
    amount: number;
    settled_at: string | null;
    requested_at: string | null;
    note: string | null;
    status: string | null;
    from_profile: ProfileData | null;
    to_profile: ProfileData | null;
    from_placeholder: PlaceholderData | null;
    to_placeholder: PlaceholderData | null;
}

/**
 * Get settlements with user names for a group
 * 
 * This function is used by both client and server services.
 * Pass the appropriate Supabase client for your context.
 * 
 * @param supabase - Supabase client (browser or server)
 * @param groupId - The group ID to fetch settlements for
 * @returns Array of settlements with resolved user names
 */
export async function getSettlementsWithNamesCore(
    supabase: SupabaseClient,
    groupId: string
): Promise<SettlementWithNames[]> {
    const { data, error } = await supabase
        .from("settlements")
        .select(`
            id,
            from_user,
            to_user,
            from_placeholder_id,
            to_placeholder_id,
            amount,
            settled_at,
            requested_at,
            note,
            status,
            from_profile:profiles!settlements_from_user_fkey(id, full_name, email),
            to_profile:profiles!settlements_to_user_fkey(id, full_name, email),
            from_placeholder:placeholder_members!settlements_from_placeholder_id_fkey(id, name),
            to_placeholder:placeholder_members!settlements_to_placeholder_id_fkey(id, name)
        `)
        .eq("group_id", groupId)
        .eq("status", "approved") // Only show approved settlements in history
        .order("settled_at", { ascending: false, nullsFirst: false })
        .order("requested_at", { ascending: false });

    if (error) {
        console.error("Error fetching settlements with names:", error);
        return [];
    }

    // Collect IDs that need placeholder lookup (profile join returned null)
    const placeholderIdsToLookup: string[] = [];
    (data || []).forEach((s) => {
        const rawS = s as unknown as RawSettlement;
        const fromProfile = rawS.from_profile;
        const toProfile = rawS.to_profile;
        const fromPlaceholder = rawS.from_placeholder;
        const toPlaceholder = rawS.to_placeholder;

        // If from_user has no profile AND no placeholder, it might be an old record
        if (rawS.from_user && !fromProfile?.full_name && !fromProfile?.email && !fromPlaceholder?.name) {
            placeholderIdsToLookup.push(rawS.from_user);
        }
        // Same for to_user
        if (rawS.to_user && !toProfile?.full_name && !toProfile?.email && !toPlaceholder?.name) {
            placeholderIdsToLookup.push(rawS.to_user);
        }
    });

    // Fetch placeholder names for old records that stored placeholder ID in from_user/to_user
    const placeholderNameMap = new Map<string, string>();
    if (placeholderIdsToLookup.length > 0) {
        const { data: placeholders } = await supabase
            .from("placeholder_members")
            .select("id, name")
            .in("id", placeholderIdsToLookup);

        (placeholders || []).forEach((p) => {
            placeholderNameMap.set(p.id, p.name);
        });
    }

    return (data || []).map((s) => {
        const rawS = s as unknown as RawSettlement;
        // Handle both real users and placeholders
        const fromProfile = rawS.from_profile;
        const toProfile = rawS.to_profile;
        const fromPlaceholder = rawS.from_placeholder;
        const toPlaceholder = rawS.to_placeholder;

        // Determine names - check placeholder first, then profile, then fallback lookup
        const fromName = fromPlaceholder?.name
            || fromProfile?.full_name
            || fromProfile?.email
            || (rawS.from_user ? placeholderNameMap.get(rawS.from_user) : undefined)
            || "Unknown";
        const toName = toPlaceholder?.name
            || toProfile?.full_name
            || toProfile?.email
            || (rawS.to_user ? placeholderNameMap.get(rawS.to_user) : undefined)
            || "Unknown";

        // Check if this involves a placeholder (should be auto-approved)
        const involvesPlaceholder = !!fromPlaceholder?.name
            || !!toPlaceholder?.name
            || (rawS.from_user ? placeholderNameMap.has(rawS.from_user) : false)
            || (rawS.to_user ? placeholderNameMap.has(rawS.to_user) : false)
            || !!rawS.from_placeholder_id
            || !!rawS.to_placeholder_id;

        // Auto-approve settlements involving placeholders (they can't respond)
        const effectiveStatus = (rawS.status === "pending" && involvesPlaceholder)
            ? "approved"
            : rawS.status;

        return {
            id: rawS.id,
            from_user: rawS.from_user || rawS.from_placeholder_id || "",
            from_user_name: fromName,
            to_user: rawS.to_user || rawS.to_placeholder_id || "",
            to_user_name: toName,
            amount: rawS.amount,
            settled_at: rawS.settled_at || rawS.requested_at || new Date().toISOString(),
            note: rawS.note,
            status: effectiveStatus || undefined,
        };
    });
}
