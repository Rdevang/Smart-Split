import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ExpenseForm } from "@/components/features/expenses/expense-form";
import { groupsCachedServerService } from "@/services/groups.cached.server";
import { decryptUrlId, encryptUrlId } from "@/lib/url-ids";

interface NewExpensePageProps {
    params: Promise<{ id: string }>;
}

export default async function NewExpensePage({ params }: NewExpensePageProps) {
    const { id: encryptedId } = await params;
    // Decrypt URL ID to get real database UUID
    const id = decryptUrlId(encryptedId);
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        redirect("/login");
    }

    // Using CACHED service for fast page loads
    const group = await groupsCachedServerService.getGroup(id);

    if (!group) {
        notFound();
    }

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            {/* Back Link */}
            <Link
                href={`/groups/${encryptUrlId(id)}`}
                className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to {group.name}
            </Link>

            {/* Form */}
            <ExpenseForm group={group} userId={user.id} />
        </div>
    );
}

