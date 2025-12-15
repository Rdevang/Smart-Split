import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");

    if (!code) {
        return NextResponse.json(
            { error: "Invite code is required" },
            { status: 400 }
        );
    }

    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
        return NextResponse.json(
            { error: "Authentication required" },
            { status: 401 }
        );
    }

    // Find group by invite code
    const { data: group, error: groupError } = await supabase
        .from("groups")
        .select(`
            id, 
            name, 
            description,
            group_members (id, user_id)
        `)
        .eq("invite_code", code.toUpperCase().trim())
        .single();

    if (groupError || !group) {
        return NextResponse.json(
            { error: "Invalid invite code. Please check and try again." },
            { status: 404 }
        );
    }

    // Check if user is already a member
    const alreadyMember = group.group_members?.some(
        (member: { user_id: string | null }) => member.user_id === user.id
    );

    return NextResponse.json({
        group: {
            id: group.id,
            name: group.name,
            description: group.description,
            member_count: group.group_members?.length || 0,
        },
        alreadyMember,
    });
}

