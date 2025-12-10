import { render, screen } from "@testing-library/react";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter,
} from "@/components/ui/card";

describe("Card Components", () => {
    describe("Card", () => {
        it("renders children", () => {
            render(<Card>Card content</Card>);
            expect(screen.getByText("Card content")).toBeInTheDocument();
        });

        it("applies default styling", () => {
            render(<Card data-testid="card">Content</Card>);
            const card = screen.getByTestId("card");
            expect(card).toHaveClass("rounded-xl", "border", "bg-white", "shadow-sm");
        });

        it("merges custom className", () => {
            render(<Card className="custom-class" data-testid="card">Content</Card>);
            expect(screen.getByTestId("card")).toHaveClass("custom-class");
        });

        it("forwards ref correctly", () => {
            const ref = jest.fn();
            render(<Card ref={ref}>Content</Card>);
            expect(ref).toHaveBeenCalled();
        });
    });

    describe("CardHeader", () => {
        it("renders children", () => {
            render(<CardHeader>Header content</CardHeader>);
            expect(screen.getByText("Header content")).toBeInTheDocument();
        });

        it("applies padding", () => {
            render(<CardHeader data-testid="header">Content</CardHeader>);
            expect(screen.getByTestId("header")).toHaveClass("p-6");
        });
    });

    describe("CardTitle", () => {
        it("renders as h3", () => {
            render(<CardTitle>Title</CardTitle>);
            expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Title");
        });

        it("applies text styling", () => {
            render(<CardTitle data-testid="title">Title</CardTitle>);
            expect(screen.getByTestId("title")).toHaveClass("text-xl", "font-semibold");
        });
    });

    describe("CardDescription", () => {
        it("renders text", () => {
            render(<CardDescription>Description text</CardDescription>);
            expect(screen.getByText("Description text")).toBeInTheDocument();
        });

        it("applies muted text styling", () => {
            render(<CardDescription data-testid="desc">Description</CardDescription>);
            expect(screen.getByTestId("desc")).toHaveClass("text-sm", "text-gray-600");
        });
    });

    describe("CardContent", () => {
        it("renders children", () => {
            render(<CardContent>Content here</CardContent>);
            expect(screen.getByText("Content here")).toBeInTheDocument();
        });

        it("applies padding without top", () => {
            render(<CardContent data-testid="content">Content</CardContent>);
            expect(screen.getByTestId("content")).toHaveClass("p-6", "pt-0");
        });
    });

    describe("CardFooter", () => {
        it("renders children", () => {
            render(<CardFooter>Footer content</CardFooter>);
            expect(screen.getByText("Footer content")).toBeInTheDocument();
        });

        it("applies flex layout", () => {
            render(<CardFooter data-testid="footer">Footer</CardFooter>);
            expect(screen.getByTestId("footer")).toHaveClass("flex", "items-center");
        });
    });

    describe("Full Card composition", () => {
        it("renders complete card structure", () => {
            render(
                <Card>
                    <CardHeader>
                        <CardTitle>Test Title</CardTitle>
                        <CardDescription>Test description</CardDescription>
                    </CardHeader>
                    <CardContent>Main content</CardContent>
                    <CardFooter>Footer actions</CardFooter>
                </Card>
            );

            expect(screen.getByRole("heading", { name: "Test Title" })).toBeInTheDocument();
            expect(screen.getByText("Test description")).toBeInTheDocument();
            expect(screen.getByText("Main content")).toBeInTheDocument();
            expect(screen.getByText("Footer actions")).toBeInTheDocument();
        });
    });
});

