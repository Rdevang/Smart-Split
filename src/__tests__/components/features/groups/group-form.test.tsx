import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GroupForm } from "@/components/features/groups/group-form";
import { groupsService } from "@/services/groups";

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush, back: mockBack, refresh: jest.fn() }) }));
jest.mock("@/services/groups", () => ({ groupsService: { createGroup: jest.fn(), updateGroup: jest.fn() } }));

const mockCreateGroup = groupsService.createGroup as jest.MockedFunction<typeof groupsService.createGroup>;

// Helper to create a mock group response
const createMockGroup = (id: string) => ({
    id,
    name: "Test Group",
    description: null,
    category: null,
    image_url: null,
    simplify_debts: false,
    created_by: "user-1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
});

describe("GroupForm", () => {
    beforeEach(() => jest.clearAllMocks());

    it("renders create mode", () => {
        render(<GroupForm userId="user-1" />);
        expect(screen.getByText("Create New Group")).toBeInTheDocument();
    });

    it("validates required name", async () => {
        const user = userEvent.setup();
        render(<GroupForm userId="user-1" />);
        await user.click(screen.getByRole("button", { name: /create group/i }));
        await waitFor(() => expect(screen.getByText("Group name is required")).toBeInTheDocument());
    });

    it("creates group successfully", async () => {
        const user = userEvent.setup();
        mockCreateGroup.mockResolvedValue({ group: createMockGroup("new-id"), error: undefined });
        render(<GroupForm userId="user-1" />);

        await user.type(screen.getByLabelText(/group name/i), "Test Group");
        await user.click(screen.getByRole("button", { name: /create group/i }));

        await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/groups/new-id"));
    });

    it("shows error on failure", async () => {
        const user = userEvent.setup();
        mockCreateGroup.mockResolvedValue({ group: null, error: "Failed" });
        render(<GroupForm userId="user-1" />);

        await user.type(screen.getByLabelText(/group name/i), "Test");
        await user.click(screen.getByRole("button", { name: /create group/i }));

        await waitFor(() => expect(screen.getByText("Failed")).toBeInTheDocument());
    });

    it("cancel goes back", async () => {
        const user = userEvent.setup();
        render(<GroupForm userId="user-1" />);
        await user.click(screen.getByRole("button", { name: /cancel/i }));
        expect(mockBack).toHaveBeenCalled();
    });
});
