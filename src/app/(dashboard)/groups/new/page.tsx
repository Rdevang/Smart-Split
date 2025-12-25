import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { GroupForm } from "@/components/features/groups/group-form";

export default async function NewGroupPage() {
    const supabase = await createClient();
    // Layout already verified auth with getUser() - use getSession() for speed
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
        redirect("/login");
    }
    const user = session.user;

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            {/* Back Link */}
            <Link
                href="/groups"
                className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to Groups
            </Link>

            {/* Form */}
            <GroupForm userId={user.id} mode="create" />
        </div>
    );
}

