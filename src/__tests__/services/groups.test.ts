import { groupsService } from "@/services/groups";
import { createClient } from "@/lib/supabase/client";

// Mock Supabase client
jest.mock("@/lib/supabase/client", () => ({
    createClient: jest.fn(),
}));

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

describe("groupsService", () => {
    let mockSupabase: {
        from: jest.Mock;
        rpc: jest.Mock;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockSupabase = {
            from: jest.fn(),
            rpc: jest.fn(),
        };
        mockCreateClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof createClient>);
    });

    describe("addMember", () => {
        it("should add an existing user to a group by email", async () => {
            const mockProfile = { id: "user-123", full_name: "John Doe" };

            mockSupabase.from.mockImplementation((table: string) => {
                if (table === "profiles") {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                single: jest.fn().mockResolvedValue({ data: mockProfile, error: null }),
                            }),
                        }),
                    };
                }
                if (table === "group_members") {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                eq: jest.fn().mockReturnValue({
                                    single: jest.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
                                }),
                            }),
                        }),
                        insert: jest.fn().mockResolvedValue({ error: null }),
                    };
                }
                if (table === "activities") {
                    return {
                        insert: jest.fn().mockResolvedValue({ error: null }),
                    };
                }
                return {};
            });

            const result = await groupsService.addMember("group-123", "john@example.com", "admin-123");

            expect(result.success).toBe(true);
        });

        it("should return error if user not found", async () => {
            mockSupabase.from.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
                    }),
                }),
            });

            const result = await groupsService.addMember("group-123", "notfound@example.com", "admin-123");

            expect(result.success).toBe(false);
            expect(result.error).toBe("User not found with this email");
        });

        it("should return error if user already a member", async () => {
            const mockProfile = { id: "user-123", full_name: "John Doe" };
            const mockMember = { id: "member-123" };

            mockSupabase.from.mockImplementation((table: string) => {
                if (table === "profiles") {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                single: jest.fn().mockResolvedValue({ data: mockProfile, error: null }),
                            }),
                        }),
                    };
                }
                if (table === "group_members") {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                eq: jest.fn().mockReturnValue({
                                    single: jest.fn().mockResolvedValue({ data: mockMember, error: null }),
                                }),
                            }),
                        }),
                    };
                }
                return {};
            });

            const result = await groupsService.addMember("group-123", "john@example.com", "admin-123");

            expect(result.success).toBe(false);
            expect(result.error).toBe("User is already a member of this group");
        });
    });

    describe("addPlaceholderMember", () => {
        it("should create a placeholder member without email", async () => {
            mockSupabase.from.mockImplementation((table: string) => {
                if (table === "profiles") {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                single: jest.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
                            }),
                        }),
                    };
                }
                if (table === "placeholder_members") {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                ilike: jest.fn().mockReturnValue({
                                    single: jest.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
                                }),
                            }),
                        }),
                        insert: jest.fn().mockReturnValue({
                            select: jest.fn().mockReturnValue({
                                single: jest.fn().mockResolvedValue({
                                    data: { id: "placeholder-123" },
                                    error: null
                                }),
                            }),
                        }),
                    };
                }
                if (table === "group_members") {
                    return {
                        insert: jest.fn().mockResolvedValue({ error: null }),
                    };
                }
                if (table === "activities") {
                    return {
                        insert: jest.fn().mockResolvedValue({ error: null }),
                    };
                }
                return {};
            });

            const result = await groupsService.addPlaceholderMember(
                "group-123",
                "Mom",
                null,
                "admin-123"
            );

            expect(result.success).toBe(true);
            expect(result.placeholderId).toBe("placeholder-123");
        });

        it("should create a placeholder member with optional email", async () => {
            mockSupabase.from.mockImplementation((table: string) => {
                if (table === "profiles") {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                single: jest.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
                            }),
                        }),
                    };
                }
                if (table === "placeholder_members") {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                ilike: jest.fn().mockReturnValue({
                                    single: jest.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
                                }),
                            }),
                        }),
                        insert: jest.fn().mockReturnValue({
                            select: jest.fn().mockReturnValue({
                                single: jest.fn().mockResolvedValue({
                                    data: { id: "placeholder-456" },
                                    error: null
                                }),
                            }),
                        }),
                    };
                }
                if (table === "group_members") {
                    return {
                        insert: jest.fn().mockResolvedValue({ error: null }),
                    };
                }
                if (table === "activities") {
                    return {
                        insert: jest.fn().mockResolvedValue({ error: null }),
                    };
                }
                return {};
            });

            const result = await groupsService.addPlaceholderMember(
                "group-123",
                "John",
                "john@future.com",
                "admin-123"
            );

            expect(result.success).toBe(true);
        });

        it("should return error if real user with email exists", async () => {
            mockSupabase.from.mockImplementation((table: string) => {
                if (table === "profiles") {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                single: jest.fn().mockResolvedValue({
                                    data: { id: "existing-user" },
                                    error: null
                                }),
                            }),
                        }),
                    };
                }
                return {};
            });

            const result = await groupsService.addPlaceholderMember(
                "group-123",
                "John",
                "existing@example.com",
                "admin-123"
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain("already exists");
        });

        it("should return error if placeholder with same name exists", async () => {
            mockSupabase.from.mockImplementation((table: string) => {
                if (table === "profiles") {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                single: jest.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
                            }),
                        }),
                    };
                }
                if (table === "placeholder_members") {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                ilike: jest.fn().mockReturnValue({
                                    single: jest.fn().mockResolvedValue({
                                        data: { id: "existing-placeholder" },
                                        error: null
                                    }),
                                }),
                            }),
                        }),
                    };
                }
                return {};
            });

            const result = await groupsService.addPlaceholderMember(
                "group-123",
                "Mom",
                null,
                "admin-123"
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain("already exists");
        });
    });

    describe("removePlaceholderMember", () => {
        it("should remove a placeholder member from group", async () => {
            mockSupabase.from.mockImplementation((table: string) => {
                return {
                    delete: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                            eq: jest.fn().mockResolvedValue({ error: null }),
                        }),
                    }),
                };
            });

            const result = await groupsService.removePlaceholderMember(
                "group-123",
                "placeholder-123",
                "admin-123"
            );

            expect(result.success).toBe(true);
        });
    });

    describe("getGroupBalances", () => {
        it("should fetch balances using RPC", async () => {
            const mockBalances = [
                { user_id: "user-1", user_name: "Alice", balance: 50.00, is_placeholder: false },
                { user_id: "user-2", user_name: "Bob", balance: -25.00, is_placeholder: false },
                { user_id: "placeholder-1", user_name: "Mom", balance: -25.00, is_placeholder: true },
            ];

            mockSupabase.rpc.mockResolvedValue({ data: mockBalances, error: null });

            const result = await groupsService.getGroupBalances("group-123");

            expect(mockSupabase.rpc).toHaveBeenCalledWith("get_group_balances", {
                group_uuid: "group-123",
            });
            expect(result).toEqual(mockBalances);
        });

        it("should return empty array on error", async () => {
            mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: "Error" } });

            const result = await groupsService.getGroupBalances("group-123");

            expect(result).toEqual([]);
        });
    });

    describe("isUserAdmin", () => {
        it("should return true if user is admin", async () => {
            mockSupabase.from.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                            single: jest.fn().mockResolvedValue({ data: { role: "admin" }, error: null }),
                        }),
                    }),
                }),
            });

            const result = await groupsService.isUserAdmin("group-123", "user-123");

            expect(result).toBe(true);
        });

        it("should return false if user is not admin", async () => {
            mockSupabase.from.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                            single: jest.fn().mockResolvedValue({ data: { role: "member" }, error: null }),
                        }),
                    }),
                }),
            });

            const result = await groupsService.isUserAdmin("group-123", "user-123");

            expect(result).toBe(false);
        });
    });
});

