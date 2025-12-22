import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/encryption";

/**
 * GET /api/upi/[userId]
 * Fetches and decrypts UPI ID for a user
 * SECURITY: Only accessible if requesting user shares a group with target user
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    const { userId } = await params;

    const supabase = await createClient();

    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // SECURITY: Allow users to fetch their own UPI ID
    if (userId !== user.id) {
        // SECURITY: Verify requesting user shares at least one group with target user
        // This prevents arbitrary users from seeing each other's UPI IDs
        const { data: sharedGroups, error: groupError } = await supabase
            .from("group_members")
            .select("group_id")
            .eq("user_id", user.id);

        if (groupError || !sharedGroups || sharedGroups.length === 0) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        const groupIds = sharedGroups.map(g => g.group_id);

        // Check if target user is in any of these groups
        const { data: targetMembership } = await supabase
            .from("group_members")
            .select("id")
            .eq("user_id", userId)
            .in("group_id", groupIds)
            .limit(1);

        if (!targetMembership || targetMembership.length === 0) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }
    }

    // Fetch UPI ID from database
    const { data, error } = await supabase
        .from("profiles")
        .select("upi_id")
        .eq("id", userId)
        .single();

    if (error) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!data?.upi_id) {
        return NextResponse.json({ upi_id: null });
    }

    // Decrypt UPI ID (server-side only)
    // Handle both encrypted and plain text UPI IDs
    const decryptedUpiId = decrypt(data.upi_id);
    
    // If decryption returned empty string (failure), the UPI ID might be corrupted
    if (!decryptedUpiId && data.upi_id) {
        console.error(`UPI decryption failed for user ${userId}`);
        return NextResponse.json({ upi_id: null, error: "UPI ID decryption failed" });
    }

    return NextResponse.json({ upi_id: decryptedUpiId });
}

