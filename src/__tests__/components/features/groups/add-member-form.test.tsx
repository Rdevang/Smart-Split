import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddMemberForm } from "@/components/features/groups/add-member-form";
import { groupsService } from "@/services/groups";

// Mock next/navigation
jest.mock("next/navigation", () => ({
    useRouter: () => ({
        refresh: jest.fn(),
    }),
}));

// Mock groups service
jest.mock("@/services/groups", () => ({
    groupsService: {
        addMember: jest.fn(),
        addPlaceholderMember: jest.fn(),
    },
}));

const mockAddMember = groupsService.addMember as jest.MockedFunction<typeof groupsService.addMember>;
const mockAddPlaceholderMember = groupsService.addPlaceholderMember as jest.MockedFunction<typeof groupsService.addPlaceholderMember>;

describe("AddMemberForm", () => {
    const defaultProps = {
        groupId: "group-123",
        userId: "user-123",
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("Toggle between modes", () => {
        it("renders with 'Existing User' mode by default", () => {
            render(<AddMemberForm {...defaultProps} />);

            expect(screen.getByText("Existing User")).toBeInTheDocument();
            expect(screen.getByText("New Person")).toBeInTheDocument();
            expect(screen.getByPlaceholderText("Enter email address")).toBeInTheDocument();
        });

        it("switches to 'New Person' mode when clicked", async () => {
            const user = userEvent.setup();
            render(<AddMemberForm {...defaultProps} />);

            await user.click(screen.getByText("New Person"));

            expect(screen.getByPlaceholderText(/Name/)).toBeInTheDocument();
            expect(screen.getByText(/Add someone who hasn't signed up yet/)).toBeInTheDocument();
        });

        it("switches back to 'Existing User' mode", async () => {
            const user = userEvent.setup();
            render(<AddMemberForm {...defaultProps} />);

            await user.click(screen.getByText("New Person"));
            await user.click(screen.getByText("Existing User"));

            expect(screen.getByPlaceholderText("Enter email address")).toBeInTheDocument();
        });
    });

    describe("Adding existing user", () => {
        it("calls addMember with email when submitting", async () => {
            const user = userEvent.setup();
            mockAddMember.mockResolvedValue({ success: true });

            render(<AddMemberForm {...defaultProps} />);

            await user.type(screen.getByPlaceholderText("Enter email address"), "john@example.com");
            await user.click(screen.getByRole("button", { name: /Add/i }));

            await waitFor(() => {
                expect(mockAddMember).toHaveBeenCalledWith("group-123", "john@example.com", "user-123");
            });
        });

        it("shows success message on successful add", async () => {
            const user = userEvent.setup();
            mockAddMember.mockResolvedValue({ success: true });

            render(<AddMemberForm {...defaultProps} />);

            await user.type(screen.getByPlaceholderText("Enter email address"), "john@example.com");
            await user.click(screen.getByRole("button", { name: /Add/i }));

            await waitFor(() => {
                expect(screen.getByText("Member added successfully!")).toBeInTheDocument();
            });
        });

        it("shows error message when user not found", async () => {
            const user = userEvent.setup();
            mockAddMember.mockResolvedValue({ success: false, error: "User not found with this email" });

            render(<AddMemberForm {...defaultProps} />);

            await user.type(screen.getByPlaceholderText("Enter email address"), "notfound@example.com");
            await user.click(screen.getByRole("button", { name: /Add/i }));

            await waitFor(() => {
                expect(screen.getByText("User not found with this email")).toBeInTheDocument();
            });
        });

        it("disables Add button when email is empty", () => {
            render(<AddMemberForm {...defaultProps} />);

            const addButton = screen.getByRole("button", { name: /Add/i });
            expect(addButton).toBeDisabled();
        });
    });

    describe("Adding placeholder member", () => {
        it("calls addPlaceholderMember with name only", async () => {
            const user = userEvent.setup();
            mockAddPlaceholderMember.mockResolvedValue({ success: true, placeholderId: "ph-123" });

            render(<AddMemberForm {...defaultProps} />);

            await user.click(screen.getByText("New Person"));
            await user.type(screen.getByPlaceholderText(/Name/), "Mom");
            await user.click(screen.getByRole("button", { name: /Add/i }));

            await waitFor(() => {
                expect(mockAddPlaceholderMember).toHaveBeenCalledWith(
                    "group-123",
                    "Mom",
                    null,
                    "user-123"
                );
            });
        });

        it("calls addPlaceholderMember with name and optional email", async () => {
            const user = userEvent.setup();
            mockAddPlaceholderMember.mockResolvedValue({ success: true, placeholderId: "ph-123" });

            render(<AddMemberForm {...defaultProps} />);

            await user.click(screen.getByText("New Person"));
            await user.type(screen.getByPlaceholderText(/Name/), "John");
            await user.type(screen.getByPlaceholderText(/Email.*optional/i), "john@future.com");
            await user.click(screen.getByRole("button", { name: /Add/i }));

            await waitFor(() => {
                expect(mockAddPlaceholderMember).toHaveBeenCalledWith(
                    "group-123",
                    "John",
                    "john@future.com",
                    "user-123"
                );
            });
        });

        it("shows success message on successful placeholder add", async () => {
            const user = userEvent.setup();
            mockAddPlaceholderMember.mockResolvedValue({ success: true, placeholderId: "ph-123" });

            render(<AddMemberForm {...defaultProps} />);

            await user.click(screen.getByText("New Person"));
            await user.type(screen.getByPlaceholderText(/Name/), "Dad");
            await user.click(screen.getByRole("button", { name: /Add/i }));

            await waitFor(() => {
                expect(screen.getByText("Member added successfully!")).toBeInTheDocument();
            });
        });

        it("shows error when placeholder with same name exists", async () => {
            const user = userEvent.setup();
            mockAddPlaceholderMember.mockResolvedValue({
                success: false,
                error: "A member with this name already exists in the group"
            });

            render(<AddMemberForm {...defaultProps} />);

            await user.click(screen.getByText("New Person"));
            await user.type(screen.getByPlaceholderText(/Name/), "Mom");
            await user.click(screen.getByRole("button", { name: /Add/i }));

            await waitFor(() => {
                expect(screen.getByText("A member with this name already exists in the group")).toBeInTheDocument();
            });
        });

        it("disables Add button when name is empty", async () => {
            const user = userEvent.setup();
            render(<AddMemberForm {...defaultProps} />);

            await user.click(screen.getByText("New Person"));

            const addButton = screen.getByRole("button", { name: /Add/i });
            expect(addButton).toBeDisabled();
        });

        it("shows hint text about placeholder functionality", async () => {
            const user = userEvent.setup();
            render(<AddMemberForm {...defaultProps} />);

            await user.click(screen.getByText("New Person"));

            expect(screen.getByText(/Add someone who hasn't signed up yet/)).toBeInTheDocument();
        });
    });

    describe("Error state clearing", () => {
        it("clears error when switching modes", async () => {
            const user = userEvent.setup();
            mockAddMember.mockResolvedValue({ success: false, error: "Some error" });

            render(<AddMemberForm {...defaultProps} />);

            await user.type(screen.getByPlaceholderText("Enter email address"), "test@test.com");
            await user.click(screen.getByRole("button", { name: /Add/i }));

            await waitFor(() => {
                expect(screen.getByText("Some error")).toBeInTheDocument();
            });

            await user.click(screen.getByText("New Person"));

            expect(screen.queryByText("Some error")).not.toBeInTheDocument();
        });
    });
});

