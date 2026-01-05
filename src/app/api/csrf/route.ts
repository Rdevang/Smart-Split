import { NextResponse } from "next/server";
import { createCsrfToken } from "@/lib/csrf";

/**
 * GET /api/csrf
 * 
 * Returns a fresh CSRF token.
 * Used by forms to get a new token before submission
 * to prevent expiration issues.
 */
export async function GET() {
    const token = await createCsrfToken();
    return NextResponse.json({ token });
}

