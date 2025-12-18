/**
 * API v1 Root Route
 * 
 * All API routes under /api/v1/* use this versioned structure.
 * 
 * VERSION HISTORY:
 * - v1 (current): Initial API version
 * 
 * DEPRECATION POLICY:
 * - New versions are announced 6 months before old versions are deprecated
 * - Deprecated versions continue to work for 12 months after deprecation notice
 * - Use the X-API-Version header to check version compatibility
 */

import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
    return NextResponse.json({
        version: "v1",
        status: "active",
        deprecation: null,
        documentation: "/docs/api/v1",
        endpoints: {
            health: "/api/v1/health",
            groups: "/api/v1/groups",
            expenses: "/api/v1/expenses",
            settlements: "/api/v1/settlements",
        },
    }, {
        headers: {
            "X-API-Version": "v1",
            "X-API-Deprecation-Notice": "none",
        },
    });
}

