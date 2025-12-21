"use server";

import { createClient } from "@/lib/supabase/server";
import { encrypt, decrypt } from "@/lib/encryption";
import { revalidatePath } from "next/cache";

export interface UpdateProfileInput {
    full_name?: string;
    phone?: string | null;
    currency?: string;
    upi_id?: string | null;
}

// Fields that should be encrypted before storage
const ENCRYPTED_FIELDS = ["upi_id", "phone"] as const;

export async function updateProfile(
    userId: string,
    input: UpdateProfileInput
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    // Verify the user is updating their own profile
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id !== userId) {
        return { success: false, error: "Unauthorized" };
    }

    // Prepare data - encrypt sensitive fields on server side
    const dataToUpdate: Record<string, unknown> = {
        ...input,
        updated_at: new Date().toISOString(),
    };

    // Encrypt sensitive fields before storing (server-side only)
    for (const field of ENCRYPTED_FIELDS) {
        if (dataToUpdate[field] && typeof dataToUpdate[field] === "string") {
            dataToUpdate[field] = encrypt(dataToUpdate[field] as string);
        }
    }

    const { error } = await supabase
        .from("profiles")
        .update(dataToUpdate)
        .eq("id", userId);

    if (error) {
        return { success: false, error: error.message };
    }

    // Also update auth metadata if full_name changed
    if (input.full_name) {
        const { error: authError } = await supabase.auth.updateUser({
            data: { full_name: input.full_name },
        });

        if (authError) {
            console.error("Error updating auth metadata:", authError);
        }
    }

    revalidatePath("/settings/profile");
    return { success: true };
}

/**
 * Get decrypted UPI ID for a user (server-side only)
 */
export async function getDecryptedUpiId(userId: string): Promise<string | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("profiles")
        .select("upi_id")
        .eq("id", userId)
        .single();

    if (error || !data?.upi_id) {
        return null;
    }

    return decrypt(data.upi_id);
}

/**
 * Decrypt sensitive profile fields (server-side only)
 * Used when fetching profile data that contains encrypted fields
 */
export async function decryptProfileData(profile: Record<string, unknown>): Promise<Record<string, unknown>> {
    const result = { ...profile };

    for (const field of ENCRYPTED_FIELDS) {
        if (result[field] && typeof result[field] === "string") {
            const decrypted = decrypt(result[field] as string);
            // Only update if decryption was successful (non-empty)
            if (decrypted) {
                result[field] = decrypted;
            }
        }
    }

    return result;
}

