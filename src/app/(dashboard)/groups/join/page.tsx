import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { JoinGroupForm } from "./join-group-form";
import { Spinner } from "@/components/ui/spinner";

interface JoinGroupPageProps {
    searchParams: Promise<{ code?: string }>;
}

async function JoinGroupContent({ searchParams }: JoinGroupPageProps) {
    const params = await searchParams;
    const supabase = await createClient();
    // Layout already verified auth with getUser() - use getSession() for speed
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
        redirect(`/login?redirect=/groups/join${params.code ? `?code=${params.code}` : ""}`);
    }

    return <JoinGroupForm initialCode={params.code || ""} userId={session.user.id} />;
}

export default function JoinGroupPage({ searchParams }: JoinGroupPageProps) {
    return (
        <div className="flex min-h-[60vh] items-center justify-center">
            <Suspense fallback={
                <div className="flex flex-col items-center gap-4">
                    <Spinner size="lg" />
                    <p className="text-gray-500 dark:text-gray-400">Loading...</p>
                </div>
            }>
                <JoinGroupContent searchParams={searchParams} />
            </Suspense>
        </div>
    );
}

