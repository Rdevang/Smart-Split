import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GroupForm } from "@/components/features/groups/group-form";
import { ToastProvider } from "@/components/ui/toast";
import { groupsService } from "@/services/groups";

const mockBack = jest.fn();
const mockRefresh = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn(), back: mockBack, refresh: mockRefresh }) }));
jest.mock("@/services/groups", () => ({ groupsService: { createGroup: jest.fn(), updateGroup: jest.fn() } }));

// Mock the server action
jest.mock("@/app/(dashboard)/actions", () => ({
    getEncryptedGroupUrl: jest.fn((id: string) => Promise.resolve(`/groups/${id}`)),
}));

const mockCreateGroup = groupsService.createGroup as jest.MockedFunction<typeof groupsService.createGroup>;
const mockUpdateGroup = groupsService.updateGroup as jest.MockedFunction<typeof groupsService.updateGroup>;

// Helper to create a mock group response
const createMockGroup = (id: string) => ({
    id,
    name: "Test Group",
    description: null,
    category: null,
    currency: "USD",
    image_url: null,
    invite_code: "ABC12345",
    simplify_debts: false,
    created_by: "user-1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
});

// Wrapper with ToastProvider
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <ToastProvider>{children}</ToastProvider>
);

describe("GroupForm", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("Create mode", () => {
        it("renders create mode", () => {
            render(<GroupForm userId="user-1" />, { wrapper: TestWrapper });
            expect(screen.getByText("Create New Group")).toBeInTheDocument();
        });

        it("validates required name", async () => {
            const user = userEvent.setup();
            render(<GroupForm userId="user-1" />, { wrapper: TestWrapper });
            await user.click(screen.getByRole("button", { name: /create group/i }));
            await waitFor(() => expect(screen.getByText("Group name is required")).toBeInTheDocument());
        });

        it("creates group successfully", async () => {
            const user = userEvent.setup();
            mockCreateGroup.mockResolvedValue({ group: createMockGroup("new-id"), error: undefined });
            render(<GroupForm userId="user-1" />, { wrapper: TestWrapper });

            await user.type(screen.getByLabelText(/group name/i), "Test Group");
            await user.click(screen.getByRole("button", { name: /create group/i }));

            // Verify createGroup was called with correct params
            await waitFor(() => {
                expect(mockCreateGroup).toHaveBeenCalledWith(
                    "user-1",
                    expect.objectContaining({ name: "Test Group" })
                );
            });
        });

        it("shows error on failure", async () => {
            const user = userEvent.setup();
            mockCreateGroup.mockResolvedValue({ group: null, error: "Failed" });
            render(<GroupForm userId="user-1" />, { wrapper: TestWrapper });

            await user.type(screen.getByLabelText(/group name/i), "Test");
            await user.click(screen.getByRole("button", { name: /create group/i }));

            // Error appears in both inline error div and toast
            await waitFor(() => expect(screen.getAllByText("Failed").length).toBeGreaterThanOrEqual(1));
        });

        it("cancel goes back", async () => {
            const user = userEvent.setup();
            render(<GroupForm userId="user-1" />, { wrapper: TestWrapper });
            await user.click(screen.getByRole("button", { name: /cancel/i }));
            expect(mockBack).toHaveBeenCalled();
        });
    });

    describe("Currency field", () => {
        it("renders currency selector", () => {
            render(<GroupForm userId="user-1" />, { wrapper: TestWrapper });
            expect(screen.getByText("Currency")).toBeInTheDocument();
        });

        it("defaults to USD", () => {
            render(<GroupForm userId="user-1" />, { wrapper: TestWrapper });
            // USD should be selected by default
            expect(screen.getByText(/USD.*US Dollar/i)).toBeInTheDocument();
        });

        it("includes currency when creating group", async () => {
            const user = userEvent.setup();
            mockCreateGroup.mockResolvedValue({ group: createMockGroup("new-id"), error: undefined });
            render(<GroupForm userId="user-1" />, { wrapper: TestWrapper });

            await user.type(screen.getByLabelText(/group name/i), "Test Group");
            await user.click(screen.getByRole("button", { name: /create group/i }));

            await waitFor(() => {
                expect(mockCreateGroup).toHaveBeenCalledWith(
                    "user-1",
                    expect.objectContaining({
                        name: "Test Group",
                        currency: "USD",
                    })
                );
            });
        });
    });

    describe("Edit mode", () => {
        const initialData = {
            id: "group-1",
            name: "Existing Group",
            description: "Test description",
            category: "trip",
            currency: "EUR",
            simplify_debts: true,
        };

        it("renders edit mode", () => {
            render(
                <GroupForm userId="user-1" mode="edit" initialData={initialData} />,
                { wrapper: TestWrapper }
            );
            expect(screen.getByText("Edit Group")).toBeInTheDocument();
        });

        it("populates form with initial data", () => {
            render(
                <GroupForm userId="user-1" mode="edit" initialData={initialData} />,
                { wrapper: TestWrapper }
            );
            expect(screen.getByDisplayValue("Existing Group")).toBeInTheDocument();
            expect(screen.getByDisplayValue("Test description")).toBeInTheDocument();
        });

        it("shows initial currency", () => {
            render(
                <GroupForm userId="user-1" mode="edit" initialData={initialData} />,
                { wrapper: TestWrapper }
            );
            // EUR should be selected
            expect(screen.getByText(/EUR.*Euro/i)).toBeInTheDocument();
        });

        it("updates group with currency", async () => {
            const user = userEvent.setup();
            mockUpdateGroup.mockResolvedValue({ success: true });
            render(
                <GroupForm userId="user-1" mode="edit" initialData={initialData} />,
                { wrapper: TestWrapper }
            );

            await user.click(screen.getByRole("button", { name: /save changes/i }));

            await waitFor(() => {
                // updateGroup now takes (groupId, data, userId)
                expect(mockUpdateGroup).toHaveBeenCalledWith(
                    "group-1",
                    expect.objectContaining({
                        currency: "EUR",
                    }),
                    "user-1"
                );
            });
        });
    });
});
