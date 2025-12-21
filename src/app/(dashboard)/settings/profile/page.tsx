import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/encryption";
import { ProfileForm } from "./profile-form";

export default async function ProfileSettingsPage() {
    const supabase = await createClient();

    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
        return null;
    }

    // Fetch profile from database (only fields we need)
    const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, phone, currency, upi_id")
        .eq("id", authUser.id)
        .single();

    // Decrypt sensitive fields (stored encrypted in DB)
    const decryptedPhone = profile?.phone ? decrypt(profile.phone) : null;
    const decryptedUpiId = profile?.upi_id ? decrypt(profile.upi_id) : null;

    const user = {
        id: authUser.id,
        email: authUser.email!,
        full_name: profile?.full_name || authUser.user_metadata?.full_name || null,
        avatar_url: profile?.avatar_url || authUser.user_metadata?.avatar_url || null,
        phone: decryptedPhone,
        currency: profile?.currency || "USD",
        upi_id: decryptedUpiId,
    };

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Profile Settings
                </h1>
                <p className="mt-1 text-gray-600 dark:text-gray-400">
                    Manage your personal information and preferences
                </p>
            </div>

            <ProfileForm user={user} />
        </div>
    );
}

