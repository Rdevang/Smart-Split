import { render, screen, waitFor, act } from "@testing-library/react";
import { Testimonials } from "@/components/features/reviews/testimonials";

// Mock fetch
global.fetch = jest.fn();

// Suppress console.error for expected errors
const originalError = console.error;
beforeAll(() => {
    console.error = jest.fn();
});
afterAll(() => {
    console.error = originalError;
});

describe("Testimonials", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("renders fallback testimonials initially", () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
        });

        render(<Testimonials />);

        // Should show fallback reviews
        expect(screen.getByText("Sarah Chen")).toBeInTheDocument();
        expect(screen.getByText("Marcus Rodriguez")).toBeInTheDocument();
        expect(screen.getByText("Priya Sharma")).toBeInTheDocument();
        expect(screen.getByText("Alex Thompson")).toBeInTheDocument();
    });

    it("renders section title and description", () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
        });

        render(<Testimonials />);

        expect(screen.getByText("Loved by thousands")).toBeInTheDocument();
        expect(screen.getByText("See what our users have to say about SmartSplit")).toBeInTheDocument();
    });

    it("fetches and displays reviews from API", async () => {
        const mockReviews = [
            {
                id: "1",
                author_name: "Test User 1",
                author_title: "Tester",
                author_avatar_url: null,
                content: "This is a test review 1",
                rating: 5,
                created_at: new Date().toISOString(),
            },
            {
                id: "2",
                author_name: "Test User 2",
                author_title: "Developer",
                author_avatar_url: null,
                content: "This is a test review 2",
                rating: 5,
                created_at: new Date().toISOString(),
            },
            {
                id: "3",
                author_name: "Test User 3",
                author_title: "Designer",
                author_avatar_url: null,
                content: "This is a test review 3",
                rating: 4,
                created_at: new Date().toISOString(),
            },
            {
                id: "4",
                author_name: "Test User 4",
                author_title: "Manager",
                author_avatar_url: null,
                content: "This is a test review 4",
                rating: 5,
                created_at: new Date().toISOString(),
            },
        ];

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ reviews: mockReviews }),
        });

        render(<Testimonials />);

        await waitFor(() => {
            expect(screen.getByText("Test User 1")).toBeInTheDocument();
        });

        expect(screen.getByText("Test User 2")).toBeInTheDocument();
        expect(screen.getByText("Test User 3")).toBeInTheDocument();
        expect(screen.getByText("Test User 4")).toBeInTheDocument();
    });

    it("fills with fallback reviews if API returns fewer than 4", async () => {
        const mockReviews = [
            {
                id: "1",
                author_name: "API User",
                author_title: "Premium",
                author_avatar_url: null,
                content: "Great app!",
                rating: 5,
                created_at: new Date().toISOString(),
            },
        ];

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ reviews: mockReviews }),
        });

        render(<Testimonials />);

        await waitFor(() => {
            expect(screen.getByText("API User")).toBeInTheDocument();
        });

        // Should also have fallback reviews to fill to 4
        // The fallbacks are: Sarah Chen, Marcus Rodriguez, Priya Sharma, Alex Thompson
        // API User is different, so we should see 3 fallbacks
        expect(screen.getByText("Sarah Chen")).toBeInTheDocument();
        expect(screen.getByText("Marcus Rodriguez")).toBeInTheDocument();
        expect(screen.getByText("Priya Sharma")).toBeInTheDocument();
    });

    it("renders star ratings for each review", () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
        });

        render(<Testimonials />);

        // Each review should have 5 stars (all fallback reviews have rating 5)
        // 4 reviews * 5 stars = 20 star icons
        const filledStars = document.querySelectorAll(".fill-amber-400");
        expect(filledStars.length).toBe(20);
    });

    it("renders author initials when no avatar", () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
        });

        render(<Testimonials />);

        // Sarah Chen -> SC, Marcus Rodriguez -> MR, etc.
        expect(screen.getByText("SC")).toBeInTheDocument();
        expect(screen.getByText("MR")).toBeInTheDocument();
        expect(screen.getByText("PS")).toBeInTheDocument();
        expect(screen.getByText("AT")).toBeInTheDocument();
    });

    it("handles API error gracefully", async () => {
        (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

        await act(async () => {
            render(<Testimonials />);
        });

        // Should still show fallback reviews
        await waitFor(() => {
            expect(screen.getByText("Sarah Chen")).toBeInTheDocument();
        });
    });
});

