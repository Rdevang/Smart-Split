import { createClient } from "@/lib/supabase/client";

export interface ProfileData {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    phone: string | null;
    currency: string;
    upi_id: string | null;
}

export interface UpdateProfileInput {
    full_name?: string;
    phone?: string | null;
    currency?: string;
    avatar_url?: string | null;
    upi_id?: string | null;
}

export const profileService = {
    async getProfile(userId: string): Promise<ProfileData | null> {
        const supabase = createClient();

        const { data, error } = await supabase
            .from("profiles")
            .select("id, email, full_name, avatar_url, phone, currency, upi_id")
            .eq("id", userId)
            .single();

        if (error) {
            console.error("Error fetching profile:", error);
            return null;
        }

        // Note: UPI ID is stored encrypted - use server action getDecryptedUpiId() to decrypt
        return data;
    },

    async updateProfile(userId: string, input: UpdateProfileInput): Promise<{ success: boolean; error?: string }> {
        const supabase = createClient();

        // Note: For UPI ID updates, use the server action updateProfile() which handles encryption
        const { error } = await supabase
            .from("profiles")
            .update({
                ...input,
                updated_at: new Date().toISOString(),
            })
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

        return { success: true };
    },

    async uploadAvatar(userId: string, file: File): Promise<{ url: string | null; error?: string }> {
        const supabase = createClient();

        // ============================================
        // SECURITY: File Validation
        // ============================================
        
        // 1. Check file size (max 2MB)
        const maxSize = 2 * 1024 * 1024; // 2MB
        if (file.size > maxSize) {
            return { url: null, error: "File size must be less than 2MB" };
        }

        // 2. Check MIME type (first layer of defense)
        const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
        if (!allowedTypes.includes(file.type)) {
            return { url: null, error: "File must be an image (JPEG, PNG, GIF, or WebP)" };
        }

        // 3. Validate magic bytes (second layer - prevents MIME spoofing)
        const magicBytesValid = await this.validateImageMagicBytes(file);
        if (!magicBytesValid) {
            return { url: null, error: "Invalid image file. File content does not match a valid image format." };
        }

        // 4. Sanitize filename (prevent path traversal)
        const safeExtension = this.getSafeExtension(file.type);
        if (!safeExtension) {
            return { url: null, error: "Invalid file type" };
        }
        const fileName = `${userId}/avatar-${Date.now()}.${safeExtension}`;

        // Delete old avatar if exists
        const { data: existingFiles } = await supabase.storage
            .from("avatars")
            .list(userId);

        if (existingFiles && existingFiles.length > 0) {
            const filesToDelete = existingFiles.map((f) => `${userId}/${f.name}`);
            await supabase.storage.from("avatars").remove(filesToDelete);
        }

        // Upload new avatar
        const { error: uploadError } = await supabase.storage
            .from("avatars")
            .upload(fileName, file, {
                cacheControl: "3600",
                upsert: true,
            });

        if (uploadError) {
            return { url: null, error: uploadError.message };
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from("avatars")
            .getPublicUrl(fileName);

        const avatarUrl = urlData.publicUrl;

        // Update profile with new avatar URL
        const { error: updateError } = await supabase
            .from("profiles")
            .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
            .eq("id", userId);

        if (updateError) {
            return { url: null, error: updateError.message };
        }

        // Update auth metadata
        await supabase.auth.updateUser({
            data: { avatar_url: avatarUrl },
        });

        return { url: avatarUrl };
    },

    async deleteAvatar(userId: string): Promise<{ success: boolean; error?: string }> {
        const supabase = createClient();

        // Delete files from storage
        const { data: existingFiles } = await supabase.storage
            .from("avatars")
            .list(userId);

        if (existingFiles && existingFiles.length > 0) {
            const filesToDelete = existingFiles.map((f) => `${userId}/${f.name}`);
            const { error: deleteError } = await supabase.storage
                .from("avatars")
                .remove(filesToDelete);

            if (deleteError) {
                return { success: false, error: deleteError.message };
            }
        }

        // Update profile to remove avatar URL
        const { error: updateError } = await supabase
            .from("profiles")
            .update({ avatar_url: null, updated_at: new Date().toISOString() })
            .eq("id", userId);

        if (updateError) {
            return { success: false, error: updateError.message };
        }

        // Update auth metadata
        await supabase.auth.updateUser({
            data: { avatar_url: null },
        });

        return { success: true };
    },

    /**
     * Get raw UPI ID for a specific user (encrypted value from DB)
     * Note: Use server action getDecryptedUpiId() to get decrypted value
     */
    async getUpiId(userId: string): Promise<string | null> {
        const supabase = createClient();

        const { data, error } = await supabase
            .from("profiles")
            .select("upi_id")
            .eq("id", userId)
            .single();

        if (error || !data || !data.upi_id) {
            return null;
        }

        return data.upi_id;
    },

    // ============================================
    // SECURITY HELPERS
    // ============================================

    /**
     * Validate image file by checking magic bytes (file signature)
     * This prevents MIME type spoofing attacks
     */
    async validateImageMagicBytes(file: File): Promise<boolean> {
        try {
            // Read first 12 bytes (enough for all signatures)
            const buffer = await file.slice(0, 12).arrayBuffer();
            const bytes = new Uint8Array(buffer);

            // JPEG: FF D8 FF
            if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
                return true;
            }

            // PNG: 89 50 4E 47 0D 0A 1A 0A
            if (
                bytes[0] === 0x89 &&
                bytes[1] === 0x50 &&
                bytes[2] === 0x4E &&
                bytes[3] === 0x47 &&
                bytes[4] === 0x0D &&
                bytes[5] === 0x0A &&
                bytes[6] === 0x1A &&
                bytes[7] === 0x0A
            ) {
                return true;
            }

            // GIF: 47 49 46 38 (GIF87a or GIF89a)
            if (
                bytes[0] === 0x47 &&
                bytes[1] === 0x49 &&
                bytes[2] === 0x46 &&
                bytes[3] === 0x38
            ) {
                return true;
            }

            // WebP: RIFF....WEBP (52 49 46 46 ... 57 45 42 50)
            if (
                bytes[0] === 0x52 &&
                bytes[1] === 0x49 &&
                bytes[2] === 0x46 &&
                bytes[3] === 0x46 &&
                bytes[8] === 0x57 &&
                bytes[9] === 0x45 &&
                bytes[10] === 0x42 &&
                bytes[11] === 0x50
            ) {
                return true;
            }

            return false;
        } catch {
            // If we can't read the file, reject it
            return false;
        }
    },

    /**
     * Get safe file extension based on MIME type
     * Prevents path traversal via malicious filenames
     */
    getSafeExtension(mimeType: string): string | null {
        const extensionMap: Record<string, string> = {
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/gif": "gif",
            "image/webp": "webp",
        };
        return extensionMap[mimeType] || null;
    },
};

