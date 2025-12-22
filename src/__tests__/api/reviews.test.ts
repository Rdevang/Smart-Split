/**
 * @jest-environment node
 */

import { GET } from "@/app/api/reviews/route";

// Mock Supabase
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockGte = jest.fn();
const mockOrder = jest.fn();
const mockLimit = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
    createClient: jest.fn(() => ({
        from: jest.fn(() => ({
            select: mockSelect,
        })),
    })),
}));

describe("Reviews API", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Setup mock chain
        mockSelect.mockReturnValue({ eq: mockEq });
        mockEq.mockReturnValue({ gte: mockGte });
        mockGte.mockReturnValue({ order: mockOrder });
        mockOrder.mockReturnValue({ limit: mockLimit });
    });

    it("returns reviews from database", async () => {
        const mockReviews = [
            {
                id: "1",
                author_name: "Test User",
                author_title: "Tester",
                content: "Great app!",
                rating: 5,
                created_at: new Date().toISOString(),
            },
        ];

        mockLimit.mockResolvedValue({ data: mockReviews, error: null });

        const response = await GET();
        const data = await response.json();

        expect(data.reviews).toEqual(mockReviews);
    });

    it("returns empty array on database error", async () => {
        mockLimit.mockResolvedValue({ 
            data: null, 
            error: new Error("Database error") 
        });

        const response = await GET();
        const data = await response.json();

        expect(data.reviews).toEqual([]);
    });

    it("filters by approved status", async () => {
        mockLimit.mockResolvedValue({ data: [], error: null });

        await GET();

        expect(mockSelect).toHaveBeenCalledWith(
            "id, author_name, author_title, author_avatar_url, content, rating, created_at"
        );
        expect(mockEq).toHaveBeenCalledWith("is_approved", true);
    });

    it("filters by rating >= 4", async () => {
        mockLimit.mockResolvedValue({ data: [], error: null });

        await GET();

        expect(mockGte).toHaveBeenCalledWith("rating", 4);
    });

    it("orders by created_at descending", async () => {
        mockLimit.mockResolvedValue({ data: [], error: null });

        await GET();

        expect(mockOrder).toHaveBeenCalledWith("created_at", { ascending: false });
    });

    it("limits results to 4", async () => {
        mockLimit.mockResolvedValue({ data: [], error: null });

        await GET();

        expect(mockLimit).toHaveBeenCalledWith(4);
    });
});

