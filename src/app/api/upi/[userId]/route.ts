import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/encryption";

/**
 * GET /api/upi/[userId]
 * Fetches and decrypts UPI ID for a user
 * 
 * Security: Only returns UPI ID if:
 * 1. User is authenticated
 * 2. Requesting user shares at least one group with the target user
 *    (so they can pay them for group expenses)
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

    // Allow users to fetch their own UPI ID
    if (user.id === userId) {
        const { data, error } = await supabase
            .from("profiles")
            .select("upi_id")
            .eq("id", userId)
            .single();

        if (error || !data?.upi_id) {
            return NextResponse.json({ upi_id: null });
        }

        const decrypted = decrypt(data.upi_id);
        // Handle plain text or failed decryption
        if (!decrypted && data.upi_id && !data.upi_id.startsWith("enc:v1:")) {
            return NextResponse.json({ upi_id: data.upi_id });
        }
        return NextResponse.json({ upi_id: decrypted || null });
    }

    // For other users, check if they share a group
    // Get groups where the requesting user is a member
    const { data: requesterGroups } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user.id);

    if (!requesterGroups || requesterGroups.length === 0) {
        return NextResponse.json(
            { error: "You can only view UPI IDs of users in your shared groups" },
            { status: 403 }
        );
    }

    const requesterGroupIds = requesterGroups.map(g => g.group_id);

    // Check if target user is in any of those groups
    const { data: sharedMembership } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", userId)
        .in("group_id", requesterGroupIds)
        .limit(1);

    if (!sharedMembership || sharedMembership.length === 0) {
        return NextResponse.json(
            { error: "You can only view UPI IDs of users in your shared groups" },
            { status: 403 }
        );
    }

    // Users share a group - fetch and return UPI ID
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
    
    // If decryption returned null (failure), check if it's plain text
    if (!decryptedUpiId && data.upi_id) {
        // If the stored value doesn't start with encryption prefix, it might be plain text
        if (!data.upi_id.startsWith("enc:v1:")) {
            // Return as-is (plain text UPI ID)
            return NextResponse.json({ upi_id: data.upi_id });
        }
        // Decryption actually failed
        console.error("UPI ID decryption failed for user:", userId);
        return NextResponse.json({ upi_id: null, error: "Decryption failed" });
    }

    return NextResponse.json({ upi_id: decryptedUpiId });
}
