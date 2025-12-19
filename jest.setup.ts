import "@testing-library/jest-dom";
import { TextEncoder, TextDecoder } from "util";

// Polyfill TextEncoder/TextDecoder for jsdom environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as typeof global.TextDecoder;

// Mock next/cache to avoid server-only code in tests
jest.mock("next/cache", () => ({
    revalidatePath: jest.fn(),
    revalidateTag: jest.fn(),
    unstable_cache: jest.fn((fn) => fn),
}));

// Mock Redis and cache modules to avoid ESM import issues
jest.mock("@/lib/redis", () => ({
    redis: null,
    isRedisAvailable: jest.fn().mockResolvedValue(false),
    getRedisHealth: jest.fn().mockResolvedValue({ status: "unavailable" }),
}));

jest.mock("@/lib/cache", () => ({
    cached: jest.fn((key, fn) => fn()),
    invalidateCache: jest.fn(),
    invalidateUserCache: jest.fn(),
    invalidateGroupCache: jest.fn(),
}));

jest.mock("@/lib/distributed-lock", () => ({
    withLock: jest.fn((key, fn) => fn()),
    LockKeys: {
        settlement: jest.fn((id) => `lock:settlement:${id}`),
        expense: jest.fn((id) => `lock:expense:${id}`),
    },
}));

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

