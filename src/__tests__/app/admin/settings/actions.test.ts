/**
 * Tests for admin settings actions
 */

import { updateAppSetting, updateRecaptchaConfig, getAppSettings } from "@/app/admin/settings/actions";

// Mock Supabase
const mockSupabaseSelect = jest.fn();
const mockSupabaseUpdate = jest.fn();
const mockSupabaseEq = jest.fn();
const mockSupabaseSingle = jest.fn();
const mockSupabaseOrder = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
    createClient: jest.fn(() => Promise.resolve({
        from: jest.fn((table: string) => {
            if (table === "profiles") {
                return {
                    select: () => ({
                        eq: () => ({
                            single: mockSupabaseSingle,
                        }),
                    }),
                };
            }
            return {
                select: mockSupabaseSelect,
                update: mockSupabaseUpdate,
            };
        }),
    })),
}));

// Mock revalidatePath
jest.mock("next/cache", () => ({
    revalidatePath: jest.fn(),
}));

// Mock clearRecaptchaSettingsCache
jest.mock("@/lib/recaptcha", () => ({
    clearRecaptchaSettingsCache: jest.fn(),
}));

describe("admin settings actions", () => {
    const adminUserId = "admin-user-123";

    beforeEach(() => {
        jest.clearAllMocks();

        // Default: user is site_admin
        mockSupabaseSingle.mockResolvedValue({
            data: { role: "site_admin" },
            error: null,
        });

        // Default update success
        mockSupabaseUpdate.mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
        });

        // Default select chain
        mockSupabaseSelect.mockReturnValue({
            eq: () => ({
                single: jest.fn().mockResolvedValue({
                    data: { value: { score_threshold: 0.5 } },
                    error: null,
                }),
            }),
            order: mockSupabaseOrder,
        });

        mockSupabaseOrder.mockReturnValue({
            order: jest.fn().mockResolvedValue({
                data: [{ id: "1", key: "recaptcha", is_enabled: true }],
                error: null,
            }),
        });
    });

    describe("updateAppSetting", () => {
        it("updates setting when user is site_admin", async () => {
            const result = await updateAppSetting("setting-123", true, adminUserId);

            expect(result.success).toBe(true);
            expect(mockSupabaseUpdate).toHaveBeenCalled();
        });

        it("returns error when user is not site_admin", async () => {
            mockSupabaseSingle.mockResolvedValue({
                data: { role: "user" },
                error: null,
            });

            const result = await updateAppSetting("setting-123", true, "regular-user");

            expect(result.success).toBe(false);
            expect(result.error).toContain("Unauthorized");
        });

        it("returns error when profile lookup fails", async () => {
            mockSupabaseSingle.mockResolvedValue({
                data: null,
                error: { message: "Not found" },
            });

            const result = await updateAppSetting("setting-123", true, adminUserId);

            expect(result.success).toBe(false);
            expect(result.error).toContain("Unauthorized");
        });

        it("returns error when update fails", async () => {
            mockSupabaseUpdate.mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: { message: "Update failed" } }),
            });

            const result = await updateAppSetting("setting-123", true, adminUserId);

            expect(result.success).toBe(false);
            expect(result.error).toBe("Update failed");
        });
    });

    describe("updateRecaptchaConfig", () => {
        it("updates score threshold successfully", async () => {
            mockSupabaseSelect.mockReturnValue({
                eq: () => ({
                    single: jest.fn().mockResolvedValue({
                        data: { value: { score_threshold: 0.5, actions: ["login"] } },
                        error: null,
                    }),
                }),
            });

            const result = await updateRecaptchaConfig(
                "setting-123",
                { score_threshold: 0.7 },
                adminUserId
            );

            expect(result.success).toBe(true);
        });

        it("returns error for invalid score threshold", async () => {
            mockSupabaseSelect.mockReturnValue({
                eq: () => ({
                    single: jest.fn().mockResolvedValue({
                        data: { value: {} },
                        error: null,
                    }),
                }),
            });

            const result = await updateRecaptchaConfig(
                "setting-123",
                { score_threshold: 1.5 }, // Invalid: > 1
                adminUserId
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain("between 0 and 1");
        });

        it("returns error for negative score threshold", async () => {
            mockSupabaseSelect.mockReturnValue({
                eq: () => ({
                    single: jest.fn().mockResolvedValue({
                        data: { value: {} },
                        error: null,
                    }),
                }),
            });

            const result = await updateRecaptchaConfig(
                "setting-123",
                { score_threshold: -0.5 }, // Invalid: < 0
                adminUserId
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain("between 0 and 1");
        });

        it("returns error when user is not site_admin", async () => {
            mockSupabaseSingle.mockResolvedValue({
                data: { role: "admin" }, // Not site_admin
                error: null,
            });

            const result = await updateRecaptchaConfig(
                "setting-123",
                { score_threshold: 0.7 },
                "regular-admin"
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain("Unauthorized");
        });

        it("returns error when fetch current value fails", async () => {
            mockSupabaseSelect.mockReturnValue({
                eq: () => ({
                    single: jest.fn().mockResolvedValue({
                        data: null,
                        error: { message: "Fetch failed" },
                    }),
                }),
            });

            const result = await updateRecaptchaConfig(
                "setting-123",
                { score_threshold: 0.7 },
                adminUserId
            );

            expect(result.success).toBe(false);
            expect(result.error).toBe("Fetch failed");
        });
    });

    describe("getAppSettings", () => {
        it("returns all app settings", async () => {
            const mockSettings = [
                { id: "1", key: "recaptcha", is_enabled: true, category: "security" },
                { id: "2", key: "maintenance_mode", is_enabled: false, category: "general" },
            ];

            mockSupabaseOrder.mockReturnValue({
                order: jest.fn().mockResolvedValue({
                    data: mockSettings,
                    error: null,
                }),
            });

            const result = await getAppSettings();

            expect(result.success).toBe(true);
            expect(result.data).toEqual(mockSettings);
        });

        it("returns error when database query fails", async () => {
            mockSupabaseOrder.mockReturnValue({
                order: jest.fn().mockResolvedValue({
                    data: null,
                    error: { message: "Query failed" },
                }),
            });

            const result = await getAppSettings();

            expect(result.success).toBe(false);
            expect(result.error).toBe("Query failed");
        });
    });
});

