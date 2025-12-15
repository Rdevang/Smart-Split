import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const {
            type,
            title,
            description,
            priority,
            email,
            name,
            user_id,
            user_agent,
            page_url,
        } = body;

        // Validate required fields
        if (!type || !title || !description) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        // Validate type
        const validTypes = ["suggestion", "feature_request", "bug_report", "other"];
        if (!validTypes.includes(type)) {
            return NextResponse.json(
                { error: "Invalid feedback type" },
                { status: 400 }
            );
        }

        // Validate priority if provided
        if (priority) {
            const validPriorities = ["low", "medium", "high", "critical"];
            if (!validPriorities.includes(priority)) {
                return NextResponse.json(
                    { error: "Invalid priority" },
                    { status: 400 }
                );
            }
        }

        const supabase = await createClient();

        // Insert feedback
        const { data, error } = await supabase
            .from("feedback")
            .insert({
                type,
                title: title.trim(),
                description: description.trim(),
                priority: type === "bug_report" ? (priority || "medium") : null,
                email: email?.trim() || null,
                name: name?.trim() || null,
                user_id: user_id || null,
                user_agent: user_agent || null,
                page_url: page_url || null,
            })
            .select()
            .single();

        if (error) {
            console.error("Feedback submission error:", error);
            return NextResponse.json(
                { error: "Failed to submit feedback" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Feedback submitted successfully",
            id: data.id,
        });
    } catch (error) {
        console.error("Feedback API error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

