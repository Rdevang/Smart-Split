import { createClient } from "@/lib/supabase/client";

export interface ProfileData {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    phone: string | null;
    currency: string;
}

export interface UpdateProfileInput {
    full_name?: string;
    phone?: string | null;
    currency?: string;
    avatar_url?: string | null;
}

export const profileService = {
    async getProfile(userId: string): Promise<ProfileData | null> {
        const supabase = createClient();

        const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .single();

        if (error) {
            console.error("Error fetching profile:", error);
            return null;
        }

        return data;
    },

    async updateProfile(userId: string, input: UpdateProfileInput): Promise<{ success: boolean; error?: string }> {
        const supabase = createClient();

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

        // Validate file
        const maxSize = 2 * 1024 * 1024; // 2MB
        if (file.size > maxSize) {
            return { url: null, error: "File size must be less than 2MB" };
        }

        const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
        if (!allowedTypes.includes(file.type)) {
            return { url: null, error: "File must be an image (JPEG, PNG, GIF, or WebP)" };
        }

        // Generate unique filename
        const fileExt = file.name.split(".").pop();
        const fileName = `${userId}/avatar-${Date.now()}.${fileExt}`;

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
};

