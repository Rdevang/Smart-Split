import { groupsService } from "@/services/groups";
import { createClient } from "@/lib/supabase/client";

// Mock Supabase client
jest.mock("@/lib/supabase/client", () => ({
    createClient: jest.fn(),
}));

// Mock notifications service
jest.mock("@/services/notifications", () => ({
    notificationsService: {
        sendGroupInvitation: jest.fn().mockResolvedValue({ success: true }),
    },
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

    // Tests for addMember with authorization layer
    describe("addMember", () => {
        it("should send invitation to an existing user by email", async () => {
            const mockProfile = { id: "user-123", full_name: "John Doe", email: "john@example.com" };
            const mockGroup = { name: "Test Group" };
            let groupMemberCallCount = 0;

            mockSupabase.from.mockImplementation((table: string) => {
                if (table === "group_members") {
                    groupMemberCallCount++;
                    if (groupMemberCallCount === 1) {
                        // First call: auth check - admin is a member
                        return {
                            select: jest.fn().mockReturnValue({
                                eq: jest.fn().mockReturnValue({
                                    eq: jest.fn().mockReturnValue({
                                        single: jest.fn().mockResolvedValue({ data: { role: "admin" }, error: null }),
                                    }),
                                }),
                            }),
                        };
                    }
                    // Second call: check if user is already member - not a member
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                eq: jest.fn().mockReturnValue({
                                    single: jest.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
                                }),
                            }),
                        }),
                    };
                }
                if (table === "profiles") {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                single: jest.fn().mockResolvedValue({ data: mockProfile, error: null }),
                            }),
                        }),
                    };
                }
                if (table === "groups") {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                single: jest.fn().mockResolvedValue({ data: mockGroup, error: null }),
                            }),
                        }),
                    };
                }
                if (table === "group_invitations") {
                    return {
                        insert: jest.fn().mockResolvedValue({ error: null }),
                    };
                }
                return {};
            });

            const result = await groupsService.addMember("00000000-0000-0000-0000-000000000001", "john@example.com", "00000000-0000-0000-0000-000000000002");

            expect(result.success).toBe(true);
            expect(result.inviteSent).toBe(true);
        });

        it("should return error if user not found", async () => {
            mockSupabase.from.mockImplementation((table: string) => {
                if (table === "group_members") {
                    // Auth check - admin is a member
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                eq: jest.fn().mockReturnValue({
                                    single: jest.fn().mockResolvedValue({ data: { role: "admin" }, error: null }),
                                }),
                            }),
                        }),
                    };
                }
                if (table === "profiles") {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                single: jest.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
                            }),
                        }),
                    };
                }
                return {};
            });

            const result = await groupsService.addMember("00000000-0000-0000-0000-000000000001", "notfound@example.com", "00000000-0000-0000-0000-000000000002");

            expect(result.success).toBe(false);
            expect(result.error).toBe("User not found with this email");
        });

        it("should return error if user already a member", async () => {
            const mockProfile = { id: "user-123", full_name: "John Doe" };
            let groupMemberCallCount = 0;

            mockSupabase.from.mockImplementation((table: string) => {
                if (table === "group_members") {
                    groupMemberCallCount++;
                    // All calls return that user is a member
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                eq: jest.fn().mockReturnValue({
                                    single: jest.fn().mockResolvedValue({
                                        data: { role: groupMemberCallCount === 1 ? "admin" : "member" },
                                        error: null
                                    }),
                                }),
                            }),
                        }),
                    };
                }
                if (table === "profiles") {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                single: jest.fn().mockResolvedValue({ data: mockProfile, error: null }),
                            }),
                        }),
                    };
                }
                return {};
            });

            const result = await groupsService.addMember("00000000-0000-0000-0000-000000000001", "john@example.com", "00000000-0000-0000-0000-000000000002");

            expect(result.success).toBe(false);
            expect(result.error).toBe("User is already a member of this group");
        });
    });

    // Tests for addPlaceholderMember with authorization layer
    describe("addPlaceholderMember", () => {
        it("should create a placeholder member without email", async () => {
            mockSupabase.from.mockImplementation((table: string) => {
                if (table === "group_members") {
                    // Auth check - admin is a member
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                eq: jest.fn().mockReturnValue({
                                    single: jest.fn().mockResolvedValue({ data: { role: "admin" }, error: null }),
                                }),
                            }),
                        }),
                        insert: jest.fn().mockResolvedValue({ error: null }),
                    };
                }
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
                if (table === "activities") {
                    return {
                        insert: jest.fn().mockResolvedValue({ error: null }),
                    };
                }
                return {};
            });

            const result = await groupsService.addPlaceholderMember(
                "00000000-0000-0000-0000-000000000001",
                "Mom",
                null,
                "00000000-0000-0000-0000-000000000002"
            );

            expect(result.success).toBe(true);
            expect(result.placeholderId).toBe("placeholder-123");
        });

        it("should create a placeholder member with optional email", async () => {
            mockSupabase.from.mockImplementation((table: string) => {
                if (table === "group_members") {
                    // Auth check - admin is a member
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                eq: jest.fn().mockReturnValue({
                                    single: jest.fn().mockResolvedValue({ data: { role: "admin" }, error: null }),
                                }),
                            }),
                        }),
                        insert: jest.fn().mockResolvedValue({ error: null }),
                    };
                }
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
                if (table === "activities") {
                    return {
                        insert: jest.fn().mockResolvedValue({ error: null }),
                    };
                }
                return {};
            });

            const result = await groupsService.addPlaceholderMember(
                "00000000-0000-0000-0000-000000000001",
                "John",
                "john@future.com",
                "00000000-0000-0000-0000-000000000002"
            );

            expect(result.success).toBe(true);
        });

        it("should return error if real user with email exists", async () => {
            mockSupabase.from.mockImplementation((table: string) => {
                if (table === "group_members") {
                    // Auth check - admin is a member
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                eq: jest.fn().mockReturnValue({
                                    single: jest.fn().mockResolvedValue({ data: { role: "admin" }, error: null }),
                                }),
                            }),
                        }),
                    };
                }
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
                "00000000-0000-0000-0000-000000000001",
                "John",
                "existing@example.com",
                "00000000-0000-0000-0000-000000000002"
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain("already exists");
        });

        it("should return error if placeholder with same name exists", async () => {
            mockSupabase.from.mockImplementation((table: string) => {
                if (table === "group_members") {
                    // Auth check - admin is a member
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                eq: jest.fn().mockReturnValue({
                                    single: jest.fn().mockResolvedValue({ data: { role: "admin" }, error: null }),
                                }),
                            }),
                        }),
                    };
                }
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
                "00000000-0000-0000-0000-000000000001",
                "Mom",
                null,
                "00000000-0000-0000-0000-000000000002"
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain("already exists");
        });
    });

    // Tests for removePlaceholderMember with authorization layer
    describe("removePlaceholderMember", () => {
        it("should remove a placeholder member from group", async () => {
            mockSupabase.from.mockImplementation((table: string) => {
                if (table === "group_members") {
                    // Auth check + delete operations
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                eq: jest.fn().mockReturnValue({
                                    single: jest.fn().mockResolvedValue({ data: { role: "admin" }, error: null }),
                                }),
                            }),
                        }),
                        delete: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                eq: jest.fn().mockResolvedValue({ error: null }),
                            }),
                        }),
                    };
                }
                if (table === "placeholder_members") {
                    // Get placeholder name + delete
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                single: jest.fn().mockResolvedValue({ data: { name: "Mom" }, error: null }),
                            }),
                        }),
                        delete: jest.fn().mockReturnValue({
                            eq: jest.fn().mockResolvedValue({ error: null }),
                        }),
                    };
                }
                if (table === "activities") {
                    return {
                        insert: jest.fn().mockResolvedValue({ error: null }),
                    };
                }
                return {};
            });

            const result = await groupsService.removePlaceholderMember(
                "00000000-0000-0000-0000-000000000001",
                "00000000-0000-0000-0000-000000000003",
                "00000000-0000-0000-0000-000000000002"
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

    describe("regenerateInviteCode", () => {
        it("should regenerate invite code successfully", async () => {
            mockSupabase.rpc.mockResolvedValue({ data: "NEWCODE1", error: null });

            const result = await groupsService.regenerateInviteCode("group-123");

            expect(mockSupabase.rpc).toHaveBeenCalledWith("regenerate_group_invite_code", {
                group_uuid: "group-123",
            });
            expect(result.success).toBe(true);
            expect(result.inviteCode).toBe("NEWCODE1");
        });

        it("should return error on failure", async () => {
            mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: "RPC error" } });

            const result = await groupsService.regenerateInviteCode("group-123");

            expect(result.success).toBe(false);
            expect(result.error).toBe("RPC error");
        });
    });

    describe("joinGroupByInviteCode", () => {
        it("should join group successfully with valid code", async () => {
            mockSupabase.rpc.mockResolvedValue({
                data: { success: true, group_id: "group-123", group_name: "Test Group" },
                error: null,
            });

            const result = await groupsService.joinGroupByInviteCode("TESTCODE", "user-123");

            expect(mockSupabase.rpc).toHaveBeenCalledWith("join_group_by_invite_code", {
                code: "TESTCODE",
                joining_user_id: "user-123",
            });
            expect(result.success).toBe(true);
            expect(result.groupId).toBe("group-123");
            expect(result.groupName).toBe("Test Group");
        });

        it("should convert code to uppercase", async () => {
            mockSupabase.rpc.mockResolvedValue({
                data: { success: true, group_id: "group-123", group_name: "Test Group" },
                error: null,
            });

            await groupsService.joinGroupByInviteCode("testcode", "user-123");

            expect(mockSupabase.rpc).toHaveBeenCalledWith("join_group_by_invite_code", {
                code: "TESTCODE",
                joining_user_id: "user-123",
            });
        });

        it("should return error for invalid code", async () => {
            mockSupabase.rpc.mockResolvedValue({
                data: { success: false, error: "Invalid invite code" },
                error: null,
            });

            const result = await groupsService.joinGroupByInviteCode("BADCODE1", "user-123");

            expect(result.success).toBe(false);
            expect(result.error).toBe("Invalid invite code");
        });

        it("should return error if already a member", async () => {
            mockSupabase.rpc.mockResolvedValue({
                data: { success: false, error: "You are already a member of this group" },
                error: null,
            });

            const result = await groupsService.joinGroupByInviteCode("TESTCODE", "user-123");

            expect(result.success).toBe(false);
            expect(result.error).toBe("You are already a member of this group");
        });

        it("should handle RPC errors", async () => {
            mockSupabase.rpc.mockResolvedValue({
                data: null,
                error: { message: "Database error" },
            });

            const result = await groupsService.joinGroupByInviteCode("TESTCODE", "user-123");

            expect(result.success).toBe(false);
            expect(result.error).toBe("Database error");
        });
    });

    describe("getGroupByInviteCode", () => {
        it("should return group for valid code", async () => {
            mockSupabase.from.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: { id: "group-123", name: "Test Group" },
                            error: null,
                        }),
                    }),
                }),
            });

            const result = await groupsService.getGroupByInviteCode("TESTCODE");

            expect(result).toEqual({ id: "group-123", name: "Test Group" });
        });

        it("should return null for invalid code", async () => {
            mockSupabase.from.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: null,
                            error: { code: "PGRST116" },
                        }),
                    }),
                }),
            });

            const result = await groupsService.getGroupByInviteCode("BADCODE1");

            expect(result).toBeNull();
        });

        it("should convert code to uppercase and trim", async () => {
            const mockEq = jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: { id: "group-123", name: "Test" }, error: null }),
            });
            mockSupabase.from.mockReturnValue({
                select: jest.fn().mockReturnValue({ eq: mockEq })
            });

            await groupsService.getGroupByInviteCode("  testcode  ");

            expect(mockSupabase.from).toHaveBeenCalledWith("groups");
            expect(mockEq).toHaveBeenCalledWith("invite_code", "TESTCODE");
        });
    });
});

