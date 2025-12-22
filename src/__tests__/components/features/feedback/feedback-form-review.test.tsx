import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeedbackForm } from "@/components/features/feedback/feedback-form";
import { ToastProvider } from "@/components/ui/toast";
import { NavigationProgressProvider } from "@/components/layout/navigation-progress";

// Mock fetch
global.fetch = jest.fn();

// Mock next/navigation
jest.mock("next/navigation", () => ({
    usePathname: () => "/feedback",
    useSearchParams: () => new URLSearchParams(),
    useRouter: () => ({
        push: jest.fn(),
        replace: jest.fn(),
        prefetch: jest.fn(),
        back: jest.fn(),
        forward: jest.fn(),
        refresh: jest.fn(),
    }),
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <NavigationProgressProvider>
        <ToastProvider>{children}</ToastProvider>
    </NavigationProgressProvider>
);

const mockUser = {
    id: "test-user-id",
    email: "test@example.com",
    full_name: "Test User",
};

describe("FeedbackForm - Review Type", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("shows star rating when Review type is selected", async () => {
        const user = userEvent.setup();

        render(<FeedbackForm user={mockUser} />, { wrapper: TestWrapper });

        // Select Review type (button text is just "Review" without emoji)
        const reviewButton = screen.getByText("Review").closest("button")!;
        await user.click(reviewButton);

        // Star rating should appear
        expect(screen.getByText("Your Rating *")).toBeInTheDocument();
        expect(screen.getByText("Excellent!")).toBeInTheDocument(); // Default 5 stars
    });

    it("does not show star rating for other types", async () => {
        const user = userEvent.setup();

        render(<FeedbackForm user={mockUser} />, { wrapper: TestWrapper });

        // Select Bug Report type (button text is just "Bug" without emoji)
        const bugButton = screen.getByText("Bug").closest("button")!;
        await user.click(bugButton);

        // Star rating should NOT appear
        expect(screen.queryByText("Your Rating *")).not.toBeInTheDocument();
    });

    it("allows changing star rating", async () => {
        const user = userEvent.setup();

        render(<FeedbackForm user={mockUser} />, { wrapper: TestWrapper });

        // Select Review type
        const reviewButton = screen.getByText("Review").closest("button")!;
        await user.click(reviewButton);

        // Click on 3rd star
        const stars = screen.getAllByRole("button").filter(btn => 
            btn.querySelector("svg.h-8")
        );
        
        // Stars should be the buttons containing Star icons (h-8 w-8)
        await user.click(stars[2]); // 3rd star (index 2)

        // Should show "Good" label for 3 stars
        expect(screen.getByText("Good")).toBeInTheDocument();
    });

    it("shows correct label for each rating", async () => {
        const user = userEvent.setup();

        render(<FeedbackForm user={mockUser} />, { wrapper: TestWrapper });

        // Select Review type
        const reviewButton = screen.getByText("Review").closest("button")!;
        await user.click(reviewButton);

        // Default should be 5 stars (Excellent!)
        expect(screen.getByText("Excellent!")).toBeInTheDocument();

        // Click on 4th star
        const stars = screen.getAllByRole("button").filter(btn => 
            btn.querySelector("svg.h-8")
        );
        await user.click(stars[3]); // 4th star
        expect(screen.getByText("Great!")).toBeInTheDocument();

        // Click on 2nd star
        await user.click(stars[1]); // 2nd star
        expect(screen.getByText("Fair")).toBeInTheDocument();

        // Click on 1st star
        await user.click(stars[0]); // 1st star
        expect(screen.getByText("Poor")).toBeInTheDocument();
    });

    it("shows note about featuring 4+ star reviews", async () => {
        const user = userEvent.setup();

        render(<FeedbackForm user={mockUser} />, { wrapper: TestWrapper });

        // Select Review type
        const reviewButton = screen.getByText("Review").closest("button")!;
        await user.click(reviewButton);

        expect(screen.getByText("Reviews with 4+ stars may be featured on our website")).toBeInTheDocument();
    });

    it("submits review with rating", async () => {
        const user = userEvent.setup();
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ success: true }),
        });

        render(<FeedbackForm user={mockUser} />, { wrapper: TestWrapper });

        // Select Review type
        const reviewButton = screen.getByText("Review").closest("button")!;
        await user.click(reviewButton);

        // Fill required fields
        const titleInput = screen.getByPlaceholderText("Brief summary of your feedback");
        await user.type(titleInput, "Great expense tracking app");

        const descriptionInput = screen.getByPlaceholderText(/Please provide as much detail as possible/i);
        await user.type(descriptionInput, "I love using SmartSplit for all my group expenses. The UX is amazing!");

        // Submit
        const submitButton = screen.getByRole("button", { name: /Submit Feedback/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                "/api/feedback",
                expect.objectContaining({
                    method: "POST",
                    body: expect.stringContaining('"rating":5'),
                })
            );
        });
    });

    it("renders all feedback type options including Review", () => {
        render(<FeedbackForm user={mockUser} />, { wrapper: TestWrapper });

        // The component shows only the text part (after emoji) due to label.split(" ")[1]
        expect(screen.getByText("Suggestion")).toBeInTheDocument();
        expect(screen.getByText("Feature")).toBeInTheDocument(); // "Feature Request" -> "Feature"
        expect(screen.getByText("Bug")).toBeInTheDocument(); // "Bug Report" -> "Bug"
        expect(screen.getByText("Review")).toBeInTheDocument();
        expect(screen.getByText("Other")).toBeInTheDocument();
    });
});

