import { render, screen } from "@testing-library/react";
import { GroupCard } from "@/components/features/groups/group-card";

jest.mock("next/link", () => ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>);

describe("GroupCard", () => {
    const group = { id: "g1", name: "Beach Trip", description: "Summer vacation", category: "trip", updated_at: "2024-12-12T10:00:00Z", member_count: 4 };

    it("renders group name and description", () => {
        render(<GroupCard group={group} />);
        expect(screen.getByText("Beach Trip")).toBeInTheDocument();
        expect(screen.getByText("Summer vacation")).toBeInTheDocument();
    });

    it("renders member count", () => {
        render(<GroupCard group={group} />);
        expect(screen.getByText("4 members")).toBeInTheDocument();
    });

    it("handles singular member", () => {
        render(<GroupCard group={{ ...group, member_count: 1 }} />);
        expect(screen.getByText("1 member")).toBeInTheDocument();
    });

    it("links to group detail page", () => {
        render(<GroupCard group={group} />);
        expect(screen.getByRole("link")).toHaveAttribute("href", "/groups/g1");
    });

    it("handles null values", () => {
        render(<GroupCard group={{ ...group, description: null, category: null }} />);
        expect(screen.getByText("Other")).toBeInTheDocument();
    });

    it("renders category emoji", () => {
        render(<GroupCard group={group} />);
        expect(screen.getByText("✈️")).toBeInTheDocument();
    });
});

