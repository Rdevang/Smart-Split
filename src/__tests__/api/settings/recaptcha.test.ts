/**
 * Tests for /api/settings/recaptcha endpoint
 */

// Mock next/server before importing the route
jest.mock("next/server", () => ({
    NextRequest: jest.fn(),
    NextResponse: {
        json: jest.fn((data) => ({
            json: () => Promise.resolve(data),
        })),
    },
}));

import { GET } from "@/app/api/settings/recaptcha/route";

// Mock Supabase
const mockSupabaseSelect = jest.fn();
const mockSupabaseEq = jest.fn();
const mockSupabaseSingle = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
    createClient: jest.fn(() => Promise.resolve({
        from: jest.fn(() => ({
            select: mockSupabaseSelect,
        })),
    })),
}));

describe("/api/settings/recaptcha", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSupabaseSelect.mockReturnValue({ eq: mockSupabaseEq });
        mockSupabaseEq.mockReturnValue({ single: mockSupabaseSingle });
    });

    describe("GET", () => {
        it("returns enabled=true when reCAPTCHA is enabled", async () => {
            mockSupabaseSingle.mockResolvedValue({
                data: { is_enabled: true },
                error: null,
            });

            process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = "test-site-key";

            const response = await GET();
            const data = await response.json();

            expect(data.enabled).toBe(true);
            expect(data.siteKey).toBe("test-site-key");
        });

        it("returns enabled=false when reCAPTCHA is disabled", async () => {
            mockSupabaseSingle.mockResolvedValue({
                data: { is_enabled: false },
                error: null,
            });

            const response = await GET();
            const data = await response.json();

            expect(data.enabled).toBe(false);
        });

        it("returns enabled=false when settings not found", async () => {
            mockSupabaseSingle.mockResolvedValue({
                data: null,
                error: { message: "Not found" },
            });

            const response = await GET();
            const data = await response.json();

            expect(data.enabled).toBe(false);
        });

        it("returns enabled=false on database error", async () => {
            mockSupabaseSingle.mockRejectedValue(new Error("Database error"));

            const response = await GET();
            const data = await response.json();

            expect(data.enabled).toBe(false);
        });

        it("does not expose siteKey when disabled", async () => {
            mockSupabaseSingle.mockResolvedValue({
                data: { is_enabled: false },
                error: null,
            });

            const response = await GET();
            const data = await response.json();

            expect(data.siteKey).toBeFalsy();
        });
    });
});

