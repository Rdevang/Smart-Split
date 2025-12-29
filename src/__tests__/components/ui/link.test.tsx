import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link } from "@/components/ui/link";
import { NavigationProgressProvider } from "@/components/layout/navigation-progress";

// Wrapper component that provides the required context
function TestWrapper({ children }: { children: React.ReactNode }) {
    return (
        <NavigationProgressProvider>{children}</NavigationProgressProvider>
    );
}

describe("Link", () => {
    it("renders as an anchor element", () => {
        render(
            <TestWrapper>
                <Link href="/test">Test Link</Link>
            </TestWrapper>
        );
        const link = screen.getByRole("link", { name: "Test Link" });
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute("href", "/test");
    });

    it("renders children correctly", () => {
        render(
            <TestWrapper>
                <Link href="/dashboard">
                    <span>Dashboard</span>
                </Link>
            </TestWrapper>
        );
        expect(screen.getByText("Dashboard")).toBeInTheDocument();
    });

    it("triggers navigation progress on click", async () => {
        const user = userEvent.setup();
        render(
            <TestWrapper>
                <Link href="/groups">Groups</Link>
            </TestWrapper>
        );

        const link = screen.getByRole("link", { name: "Groups" });
        await user.click(link);
        // Link should still work (no errors thrown)
        expect(link).toBeInTheDocument();
    });

    it("calls custom onClick handler", async () => {
        const user = userEvent.setup();
        const handleClick = jest.fn();

        render(
            <TestWrapper>
                <Link href="/test" onClick={handleClick}>Click Me</Link>
            </TestWrapper>
        );

        await user.click(screen.getByRole("link"));
        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("does not trigger progress for external links", async () => {
        const user = userEvent.setup();
        render(
            <TestWrapper>
                <Link href="https://external.com">External</Link>
            </TestWrapper>
        );

        const link = screen.getByRole("link", { name: "External" });
        await user.click(link);
        // Should not throw error
        expect(link).toHaveAttribute("href", "https://external.com");
    });

    it("does not trigger progress for anchor links", async () => {
        const user = userEvent.setup();
        render(
            <TestWrapper>
                <Link href="#section">Anchor</Link>
            </TestWrapper>
        );

        const link = screen.getByRole("link", { name: "Anchor" });
        await user.click(link);
        expect(link).toHaveAttribute("href", "#section");
    });

    it("passes through additional props", () => {
        render(
            <TestWrapper>
                <Link href="/test" className="custom-class" data-testid="custom-link">
                    Test
                </Link>
            </TestWrapper>
        );

        const link = screen.getByTestId("custom-link");
        expect(link).toHaveClass("custom-class");
    });

    it("supports target attribute for external links", () => {
        render(
            <TestWrapper>
                <Link href="https://example.com" target="_blank" rel="noopener noreferrer">
                    External Link
                </Link>
            </TestWrapper>
        );

        const link = screen.getByRole("link", { name: "External Link" });
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("works without NavigationProgressProvider (graceful degradation)", () => {
        // Link should work even without the provider (for admin pages, etc.)
        render(<Link href="/test">Test</Link>);

        const link = screen.getByRole("link", { name: "Test" });
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute("href", "/test");
    });
});

