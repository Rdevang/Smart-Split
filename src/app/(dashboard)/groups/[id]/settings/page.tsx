import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { GroupForm } from "@/components/features/groups/group-form";
import { GroupQRCode } from "@/components/features/groups/group-qr-code";
import { groupsServerService } from "@/services/groups.server";

interface GroupSettingsPageProps {
    params: Promise<{ id: string }>;
}

export default async function GroupSettingsPage({ params }: GroupSettingsPageProps) {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        redirect("/login");
    }

    const group = await groupsServerService.getGroup(id);

    if (!group) {
        notFound();
    }

    // Check if user is admin
    const isAdmin = await groupsServerService.isUserAdmin(id, user.id);

    if (!isAdmin) {
        redirect(`/groups/${id}`);
    }

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            {/* Back Link */}
            <Link
                href={`/groups/${id}`}
                className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to {group.name}
            </Link>

            {/* QR Code Section */}
            <GroupQRCode
                groupId={group.id}
                groupName={group.name}
                inviteCode={group.invite_code}
                isAdmin={isAdmin}
            />

            {/* Form */}
            <GroupForm
                userId={user.id}
                mode="edit"
                initialData={{
                    id: group.id,
                    name: group.name,
                    description: group.description,
                    category: group.category,
                    simplify_debts: group.simplify_debts,
                }}
            />
        </div>
    );
}

