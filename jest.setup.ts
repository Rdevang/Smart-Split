import "@testing-library/jest-dom";

// Mock Next.js router
jest.mock("next/navigation", () => ({
    useRouter: () => ({
        push: jest.fn(),
        replace: jest.fn(),
        refresh: jest.fn(),
        back: jest.fn(),
        forward: jest.fn(),
        prefetch: jest.fn(),
    }),
    usePathname: () => "/",
    useSearchParams: () => new URLSearchParams(),
}));

// Mock Supabase client
jest.mock("@/lib/supabase/client", () => ({
    createClient: () => ({
        auth: {
            getUser: jest.fn(),
            signInWithPassword: jest.fn(),
            signUp: jest.fn(),
            signOut: jest.fn(),
            updateUser: jest.fn(),
        },
        from: jest.fn(() => ({
            select: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            delete: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn(),
        })),
        storage: {
            from: jest.fn(() => ({
                upload: jest.fn(),
                remove: jest.fn(),
                list: jest.fn(),
                getPublicUrl: jest.fn(() => ({ data: { publicUrl: "https://example.com/avatar.jpg" } })),
            })),
        },
    }),
}));

