import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthTestimonial } from "@/components/features/reviews/auth-testimonial";

// Mock timers for auto-rotation testing
jest.useFakeTimers();

describe("AuthTestimonial", () => {
    afterEach(() => {
        jest.clearAllTimers();
    });

    it("renders the first testimonial initially", () => {
        render(<AuthTestimonial />);
        
        expect(screen.getByText(/SmartSplit made our group trip/i)).toBeInTheDocument();
        expect(screen.getByText("Sarah Chen")).toBeInTheDocument();
        expect(screen.getByText("Travel Enthusiast")).toBeInTheDocument();
    });

    it("renders author initials in avatar", () => {
        render(<AuthTestimonial />);
        
        expect(screen.getByText("SC")).toBeInTheDocument(); // Sarah Chen
    });

    it("renders navigation dots for all testimonials", () => {
        render(<AuthTestimonial />);
        
        const dots = screen.getAllByRole("button", { name: /Show testimonial/i });
        expect(dots).toHaveLength(4);
    });

    it("changes testimonial when clicking on a dot", async () => {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
        render(<AuthTestimonial />);
        
        // Click second dot
        const dots = screen.getAllByRole("button", { name: /Show testimonial/i });
        await user.click(dots[1]);
        
        // Wait for animation
        act(() => {
            jest.advanceTimersByTime(400);
        });
        
        expect(screen.getByText("Marcus Rodriguez")).toBeInTheDocument();
        expect(screen.getByText("Roommate")).toBeInTheDocument();
    });

    it("auto-rotates testimonials after 5 seconds", () => {
        render(<AuthTestimonial />);
        
        // Initial state
        expect(screen.getByText("Sarah Chen")).toBeInTheDocument();
        
        // Advance timer by 5 seconds + animation time
        act(() => {
            jest.advanceTimersByTime(5300);
        });
        
        // Should show second testimonial
        expect(screen.getByText("Marcus Rodriguez")).toBeInTheDocument();
    });

    it("has correct active dot styling", () => {
        render(<AuthTestimonial />);
        
        const dots = screen.getAllByRole("button", { name: /Show testimonial/i });
        
        // First dot should be active (wider)
        expect(dots[0]).toHaveClass("w-8");
        expect(dots[1]).toHaveClass("w-2");
    });
});

