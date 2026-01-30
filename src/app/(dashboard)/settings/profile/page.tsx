import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/encryption";
import { ProfileForm } from "./profile-form";
import { EmailPreferencesForm } from "@/components/features/settings/email-preferences";

interface EmailPreferences {
    payment_reminders: boolean;
    settlement_requests: boolean;
    settlement_updates: boolean;
    group_invitations: boolean;
    expense_added: boolean;
    weekly_digest: boolean;
}

export default async function ProfileSettingsPage() {
    const supabase = await createClient();
    const { data: { user: authUser }, error } = await supabase.auth.getUser();

    if (error || !authUser) {
        return null;
    }

    // Fetch profile from database (only fields we need)
    const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, phone, currency, upi_id, email_preferences")
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

    // Default email preferences if not set
    const defaultEmailPreferences: EmailPreferences = {
        payment_reminders: true,
        settlement_requests: true,
        settlement_updates: true,
        group_invitations: true,
        expense_added: false,
        weekly_digest: true,
    };

    const emailPreferences: EmailPreferences = profile?.email_preferences
        ? (profile.email_preferences as EmailPreferences)
        : defaultEmailPreferences;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Profile Settings
                </h1>
                <p className="mt-1 text-gray-600 dark:text-gray-400">
                    Manage your personal information and preferences
                </p>
            </div>

            <ProfileForm user={user} />

            <EmailPreferencesForm
                userId={authUser.id}
                initialPreferences={emailPreferences}
            />
        </div>
    );
}

