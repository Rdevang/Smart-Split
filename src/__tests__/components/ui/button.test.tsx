import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/button";

describe("Button", () => {
    it("renders with children", () => {
        render(<Button>Click me</Button>);
        expect(screen.getByRole("button", { name: /click me/i })).toBeInTheDocument();
    });

    it("applies primary variant by default", () => {
        render(<Button>Primary</Button>);
        const button = screen.getByRole("button");
        expect(button).toHaveClass("bg-teal-600");
    });

    it("applies secondary variant when specified", () => {
        render(<Button variant="secondary">Secondary</Button>);
        const button = screen.getByRole("button");
        expect(button).toHaveClass("bg-gray-100");
    });

    it("applies outline variant when specified", () => {
        render(<Button variant="outline">Outline</Button>);
        const button = screen.getByRole("button");
        expect(button).toHaveClass("border-teal-600");
    });

    it("applies ghost variant when specified", () => {
        render(<Button variant="ghost">Ghost</Button>);
        const button = screen.getByRole("button");
        expect(button).toHaveClass("text-gray-600");
    });

    it("applies danger variant when specified", () => {
        render(<Button variant="danger">Danger</Button>);
        const button = screen.getByRole("button");
        expect(button).toHaveClass("bg-red-600");
    });

    it("applies different sizes", () => {
        const { rerender } = render(<Button size="sm">Small</Button>);
        expect(screen.getByRole("button")).toHaveClass("h-9");

        rerender(<Button size="md">Medium</Button>);
        expect(screen.getByRole("button")).toHaveClass("h-11");

        rerender(<Button size="lg">Large</Button>);
        expect(screen.getByRole("button")).toHaveClass("h-12");
    });

    it("shows loading spinner when isLoading is true", () => {
        render(<Button isLoading>Loading</Button>);
        const button = screen.getByRole("button");
        expect(button).toBeDisabled();
        expect(button.querySelector("svg.animate-spin")).toBeInTheDocument();
    });

    it("is disabled when disabled prop is true", () => {
        render(<Button disabled>Disabled</Button>);
        expect(screen.getByRole("button")).toBeDisabled();
    });

    it("calls onClick when clicked", async () => {
        const user = userEvent.setup();
        const handleClick = jest.fn();
        render(<Button onClick={handleClick}>Click me</Button>);

        await user.click(screen.getByRole("button"));
        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("does not call onClick when disabled", async () => {
        const user = userEvent.setup();
        const handleClick = jest.fn();
        render(<Button onClick={handleClick} disabled>Click me</Button>);

        await user.click(screen.getByRole("button"));
        expect(handleClick).not.toHaveBeenCalled();
    });

    it("merges custom className", () => {
        render(<Button className="custom-class">Custom</Button>);
        expect(screen.getByRole("button")).toHaveClass("custom-class");
    });

    it("forwards ref correctly", () => {
        const ref = jest.fn();
        render(<Button ref={ref}>Ref</Button>);
        expect(ref).toHaveBeenCalled();
    });
});

