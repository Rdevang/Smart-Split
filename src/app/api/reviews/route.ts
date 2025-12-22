import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 3600; // Cache for 1 hour

export async function GET() {
    try {
        const supabase = await createClient();
        
        // Fetch latest 4 approved reviews with rating 4 or higher
        const { data: reviews, error } = await supabase
            .from("reviews")
            .select("id, author_name, author_title, author_avatar_url, content, rating, created_at")
            .eq("is_approved", true)
            .gte("rating", 4)
            .order("created_at", { ascending: false })
            .limit(4);
        
        if (error) {
            console.error("[Reviews] Fetch error:", error);
            return NextResponse.json({ reviews: [] });
        }
        
        return NextResponse.json({ reviews: reviews || [] });
    } catch (error) {
        console.error("[Reviews] Error:", error);
        return NextResponse.json({ reviews: [] });
    }
}

