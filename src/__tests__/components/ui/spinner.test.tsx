import { render, screen } from "@testing-library/react";
import { Spinner } from "@/components/ui/spinner";

describe("Spinner", () => {
    it("renders with default props", () => {
        render(<Spinner />);
        const spinner = screen.getByRole("status");
        expect(spinner).toBeInTheDocument();
        expect(spinner).toHaveAttribute("aria-label", "Loading");
    });

    it("renders with custom label", () => {
        render(<Spinner label="Loading data..." />);
        const spinner = screen.getByRole("status");
        expect(spinner).toHaveAttribute("aria-label", "Loading data...");
        // Both visible and sr-only spans have the label text
        const labels = screen.getAllByText("Loading data...");
        expect(labels).toHaveLength(2);
    });

    it("renders screen reader text", () => {
        render(<Spinner />);
        expect(screen.getByText("Loading...")).toHaveClass("sr-only");
    });

    it("applies size variants correctly", () => {
        const { rerender } = render(<Spinner size="sm" />);
        let spinnerElement = screen.getByRole("status").querySelector("div");
        expect(spinnerElement).toHaveClass("h-4", "w-4");

        rerender(<Spinner size="lg" />);
        spinnerElement = screen.getByRole("status").querySelector("div");
        expect(spinnerElement).toHaveClass("h-8", "w-8");

        rerender(<Spinner size="xl" />);
        spinnerElement = screen.getByRole("status").querySelector("div");
        expect(spinnerElement).toHaveClass("h-12", "w-12");
    });

    it("applies variant styles correctly", () => {
        const { rerender } = render(<Spinner variant="default" />);
        let spinnerElement = screen.getByRole("status").querySelector("div");
        expect(spinnerElement).toHaveClass("text-teal-500");

        rerender(<Spinner variant="muted" />);
        spinnerElement = screen.getByRole("status").querySelector("div");
        expect(spinnerElement).toHaveClass("text-gray-400");

        rerender(<Spinner variant="white" />);
        spinnerElement = screen.getByRole("status").querySelector("div");
        expect(spinnerElement).toHaveClass("text-white");
    });

    it("applies custom className", () => {
        render(<Spinner className="custom-class" />);
        const spinner = screen.getByRole("status");
        expect(spinner).toHaveClass("custom-class");
    });

    it("has animation class for spinning", () => {
        render(<Spinner />);
        const spinnerElement = screen.getByRole("status").querySelector("div");
        expect(spinnerElement).toHaveClass("animate-spin");
    });

    it("renders label alongside spinner when provided", () => {
        render(<Spinner label="Please wait" />);
        // Get the visible label (not sr-only)
        const labels = screen.getAllByText("Please wait");
        const visibleLabel = labels.find(el => !el.classList.contains("sr-only"));
        expect(visibleLabel).toHaveClass("ml-2", "text-sm");
    });
});

