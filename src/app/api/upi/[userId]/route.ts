import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/encryption";

/**
 * GET /api/upi/[userId]
 * Fetches and decrypts UPI ID for a user
 * Only accessible to authenticated users
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
    const decryptedUpiId = decrypt(data.upi_id);

    return NextResponse.json({ upi_id: decryptedUpiId });
}

