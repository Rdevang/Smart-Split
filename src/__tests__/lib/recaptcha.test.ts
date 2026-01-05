/**
 * Tests for reCAPTCHA server-side verification
 */

import { verifyRecaptcha, getRecaptchaSettings, clearRecaptchaSettingsCache, validateRecaptchaFromForm } from "@/lib/recaptcha";

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

// Mock logger
jest.mock("@/lib/logger", () => ({
    logger: {
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
    },
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("recaptcha", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        clearRecaptchaSettingsCache();

        // Setup default Supabase chain
        mockSupabaseSelect.mockReturnValue({ eq: mockSupabaseEq });
        mockSupabaseEq.mockReturnValue({ single: mockSupabaseSingle });

        // Default: reCAPTCHA disabled
        mockSupabaseSingle.mockResolvedValue({
            data: {
                is_enabled: false,
                value: { score_threshold: 0.5, actions: ["login", "register"], bypass_for_authenticated: false },
            },
            error: null,
        });
    });

    describe("getRecaptchaSettings", () => {
        it("returns settings from database", async () => {
            mockSupabaseSingle.mockResolvedValue({
                data: {
                    is_enabled: true,
                    value: { score_threshold: 0.7, actions: ["login"], bypass_for_authenticated: true },
                },
                error: null,
            });

            const settings = await getRecaptchaSettings();

            expect(settings.is_enabled).toBe(true);
            expect(settings.score_threshold).toBe(0.7);
            expect(settings.actions).toEqual(["login"]);
            expect(settings.bypass_for_authenticated).toBe(true);
        });

        it("returns defaults when database error", async () => {
            mockSupabaseSingle.mockResolvedValue({
                data: null,
                error: { message: "Not found" },
            });

            const settings = await getRecaptchaSettings();

            expect(settings.is_enabled).toBe(false);
            expect(settings.score_threshold).toBe(0.5);
        });

        it("caches settings for subsequent calls", async () => {
            mockSupabaseSingle.mockResolvedValue({
                data: { is_enabled: true, value: { score_threshold: 0.5 } },
                error: null,
            });

            await getRecaptchaSettings();
            await getRecaptchaSettings();
            await getRecaptchaSettings();

            // Should only call database once due to caching
            expect(mockSupabaseSingle).toHaveBeenCalledTimes(1);
        });
    });

    describe("verifyRecaptcha", () => {
        it("returns success with skipped=true when reCAPTCHA is disabled", async () => {
            mockSupabaseSingle.mockResolvedValue({
                data: { is_enabled: false, value: {} },
                error: null,
            });

            const result = await verifyRecaptcha("some-token", "login");

            expect(result.success).toBe(true);
            expect(result.skipped).toBe(true);
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it("returns success with skipped=true when action not in protected list", async () => {
            mockSupabaseSingle.mockResolvedValue({
                data: {
                    is_enabled: true,
                    value: { score_threshold: 0.5, actions: ["login"], bypass_for_authenticated: false },
                },
                error: null,
            });

            const result = await verifyRecaptcha("some-token", "some-other-action");

            expect(result.success).toBe(true);
            expect(result.skipped).toBe(true);
        });

        it("returns success with skipped=true for authenticated users when bypass enabled", async () => {
            mockSupabaseSingle.mockResolvedValue({
                data: {
                    is_enabled: true,
                    value: { score_threshold: 0.5, actions: ["login"], bypass_for_authenticated: true },
                },
                error: null,
            });

            const result = await verifyRecaptcha("some-token", "login", true);

            expect(result.success).toBe(true);
            expect(result.skipped).toBe(true);
        });

        it("returns error when token is missing", async () => {
            mockSupabaseSingle.mockResolvedValue({
                data: {
                    is_enabled: true,
                    value: { score_threshold: 0.5, actions: ["login"], bypass_for_authenticated: false },
                },
                error: null,
            });

            // Set secret key
            process.env.RECAPTCHA_SECRET_KEY = "test-secret";

            const result = await verifyRecaptcha(null, "login");

            expect(result.success).toBe(false);
            expect(result.error).toContain("required");
        });

        it("verifies token successfully with Google API", async () => {
            mockSupabaseSingle.mockResolvedValue({
                data: {
                    is_enabled: true,
                    value: { score_threshold: 0.5, actions: ["login"], bypass_for_authenticated: false },
                },
                error: null,
            });

            process.env.RECAPTCHA_SECRET_KEY = "test-secret";

            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    success: true,
                    score: 0.9,
                    action: "login",
                }),
            });

            const result = await verifyRecaptcha("valid-token", "login");

            expect(result.success).toBe(true);
            expect(result.score).toBe(0.9);
            expect(result.action).toBe("login");
            expect(mockFetch).toHaveBeenCalledWith(
                "https://www.google.com/recaptcha/api/siteverify",
                expect.objectContaining({
                    method: "POST",
                })
            );
        });

        it("returns error when score is below threshold", async () => {
            mockSupabaseSingle.mockResolvedValue({
                data: {
                    is_enabled: true,
                    value: { score_threshold: 0.5, actions: ["login"], bypass_for_authenticated: false },
                },
                error: null,
            });

            process.env.RECAPTCHA_SECRET_KEY = "test-secret";

            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    success: true,
                    score: 0.2,
                    action: "login",
                }),
            });

            const result = await verifyRecaptcha("valid-token", "login");

            expect(result.success).toBe(false);
            expect(result.score).toBe(0.2);
            expect(result.error).toContain("Security check failed");
        });

        it("returns error when action mismatch", async () => {
            mockSupabaseSingle.mockResolvedValue({
                data: {
                    is_enabled: true,
                    value: { score_threshold: 0.5, actions: ["login"], bypass_for_authenticated: false },
                },
                error: null,
            });

            process.env.RECAPTCHA_SECRET_KEY = "test-secret";

            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    success: true,
                    score: 0.9,
                    action: "register", // Different from expected "login"
                }),
            });

            const result = await verifyRecaptcha("valid-token", "login");

            expect(result.success).toBe(false);
            expect(result.error).toContain("Security verification failed");
        });

        it("returns error when Google API fails", async () => {
            mockSupabaseSingle.mockResolvedValue({
                data: {
                    is_enabled: true,
                    value: { score_threshold: 0.5, actions: ["login"], bypass_for_authenticated: false },
                },
                error: null,
            });

            process.env.RECAPTCHA_SECRET_KEY = "test-secret";

            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    success: false,
                    "error-codes": ["invalid-input-response"],
                }),
            });

            const result = await verifyRecaptcha("invalid-token", "login");

            expect(result.success).toBe(false);
            expect(result.error).toContain("verification failed");
        });

        it("returns error when fetch throws", async () => {
            mockSupabaseSingle.mockResolvedValue({
                data: {
                    is_enabled: true,
                    value: { score_threshold: 0.5, actions: ["login"], bypass_for_authenticated: false },
                },
                error: null,
            });

            process.env.RECAPTCHA_SECRET_KEY = "test-secret";

            mockFetch.mockRejectedValue(new Error("Network error"));

            const result = await verifyRecaptcha("valid-token", "login");

            expect(result.success).toBe(false);
            expect(result.error).toContain("error");
        });
    });

    describe("validateRecaptchaFromForm", () => {
        it("extracts token from FormData and validates", async () => {
            mockSupabaseSingle.mockResolvedValue({
                data: { is_enabled: false, value: {} },
                error: null,
            });

            const formData = new FormData();
            formData.append("recaptcha_token", "test-token");
            formData.append("email", "test@example.com");

            const result = await validateRecaptchaFromForm(formData, "login");

            expect(result.success).toBe(true);
            expect(result.skipped).toBe(true);
        });

        it("handles missing token in FormData", async () => {
            mockSupabaseSingle.mockResolvedValue({
                data: {
                    is_enabled: true,
                    value: { score_threshold: 0.5, actions: ["login"], bypass_for_authenticated: false },
                },
                error: null,
            });

            process.env.RECAPTCHA_SECRET_KEY = "test-secret";

            const formData = new FormData();
            formData.append("email", "test@example.com");

            const result = await validateRecaptchaFromForm(formData, "login");

            expect(result.success).toBe(false);
            expect(result.error).toContain("required");
        });
    });

    describe("clearRecaptchaSettingsCache", () => {
        it("clears cache so next call fetches from database", async () => {
            mockSupabaseSingle.mockResolvedValue({
                data: { is_enabled: true, value: { score_threshold: 0.5 } },
                error: null,
            });

            // First call - fetches from DB
            await getRecaptchaSettings();
            expect(mockSupabaseSingle).toHaveBeenCalledTimes(1);

            // Second call - uses cache
            await getRecaptchaSettings();
            expect(mockSupabaseSingle).toHaveBeenCalledTimes(1);

            // Clear cache
            clearRecaptchaSettingsCache();

            // Third call - fetches from DB again
            await getRecaptchaSettings();
            expect(mockSupabaseSingle).toHaveBeenCalledTimes(2);
        });
    });
});

