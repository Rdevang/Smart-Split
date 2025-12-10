import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "@/components/ui/input";

describe("Input", () => {
    it("renders with placeholder", () => {
        render(<Input placeholder="Enter text" />);
        expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument();
    });

    it("renders with label", () => {
        render(<Input label="Email" />);
        expect(screen.getByText("Email")).toBeInTheDocument();
    });

    it("associates label with input", () => {
        render(<Input label="Email" id="email-input" />);
        const input = screen.getByLabelText("Email");
        expect(input).toHaveAttribute("id", "email-input");
    });

    it("generates id from label if not provided", () => {
        render(<Input label="Full Name" />);
        const input = screen.getByLabelText("Full Name");
        expect(input).toHaveAttribute("id", "full-name");
    });

    it("displays error message", () => {
        render(<Input error="This field is required" />);
        expect(screen.getByText("This field is required")).toBeInTheDocument();
    });

    it("applies error styling when error is present", () => {
        render(<Input error="Error" />);
        const input = screen.getByRole("textbox");
        expect(input).toHaveClass("border-red-500");
    });

    it("displays helper text", () => {
        render(<Input helperText="Enter your email address" />);
        expect(screen.getByText("Enter your email address")).toBeInTheDocument();
    });

    it("hides helper text when error is present", () => {
        render(<Input helperText="Helper" error="Error" />);
        expect(screen.queryByText("Helper")).not.toBeInTheDocument();
        expect(screen.getByText("Error")).toBeInTheDocument();
    });

    it("handles different input types", () => {
        const { rerender, container } = render(<Input type="email" />);
        expect(screen.getByRole("textbox")).toHaveAttribute("type", "email");

        rerender(<Input type="password" />);
        const passwordInput = container.querySelector('input[type="password"]');
        expect(passwordInput).toBeInTheDocument();
    });

    it("can be disabled", () => {
        render(<Input disabled />);
        expect(screen.getByRole("textbox")).toBeDisabled();
    });

    it("handles user input", async () => {
        const user = userEvent.setup();
        render(<Input />);
        const input = screen.getByRole("textbox");

        await user.type(input, "Hello World");
        expect(input).toHaveValue("Hello World");
    });

    it("calls onChange when value changes", async () => {
        const user = userEvent.setup();
        const handleChange = jest.fn();
        render(<Input onChange={handleChange} />);

        await user.type(screen.getByRole("textbox"), "a");
        expect(handleChange).toHaveBeenCalled();
    });

    it("merges custom className", () => {
        render(<Input className="custom-class" />);
        expect(screen.getByRole("textbox")).toHaveClass("custom-class");
    });

    it("forwards ref correctly", () => {
        const ref = jest.fn();
        render(<Input ref={ref} />);
        expect(ref).toHaveBeenCalled();
    });
});

