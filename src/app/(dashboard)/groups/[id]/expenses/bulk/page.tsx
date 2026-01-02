import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { groupsServerService } from "@/services/groups.server";
import { BulkExpenseForm } from "@/components/features/expenses/bulk-expense-form";
import { decryptUrlId } from "@/lib/url-ids";

interface BulkExpensePageProps {
    params: Promise<{ id: string }>;
}

export default async function BulkExpensePage({ params }: BulkExpensePageProps) {
    const { id: encryptedId } = await params;
    const supabase = await createClient();

    // Verify auth
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
        redirect("/login");
    }

    // Decrypt group ID
    const groupId = decryptUrlId(encryptedId);
    if (!groupId) {
        redirect("/groups");
    }

    // Get group with members
    const group = await groupsServerService.getGroup(groupId);
    if (!group) {
        redirect("/groups");
    }

    // Transform members for the form
    const formGroup = {
        id: group.id,
        name: group.name,
        members: group.members.map((member) => ({
            id: member.id,
            user_id: member.user_id,
            role: member.role,
            is_placeholder: member.is_placeholder,
            profile: member.profile ? {
                id: member.profile.id,
                email: member.profile.email,
                full_name: member.profile.full_name,
                avatar_url: member.profile.avatar_url,
            } : null,
            placeholder: member.placeholder ? {
                id: member.placeholder.id,
                name: member.placeholder.name,
                email: member.placeholder.email,
            } : null,
        })),
    };

    return (
        <div className="max-w-5xl mx-auto">
            <BulkExpenseForm group={formGroup} userId={session.user.id} />
        </div>
    );
}

