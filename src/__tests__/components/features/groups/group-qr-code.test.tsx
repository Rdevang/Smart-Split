import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GroupQRCode } from "@/components/features/groups/group-qr-code";
import { ToastProvider } from "@/components/ui/toast";
import { groupsService } from "@/services/groups";

// Mock the groups service
jest.mock("@/services/groups", () => ({
    groupsService: {
        regenerateInviteCode: jest.fn(),
    },
}));

// Mock QRCodeSVG
jest.mock("qrcode.react", () => ({
    QRCodeSVG: ({ value }: { value: string }) => (
        <div data-testid="qr-code" data-value={value}>
            QR Code
        </div>
    ),
}));

// Mock clipboard API for jsdom
Object.defineProperty(navigator, "clipboard", {
    value: { writeText: jest.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
});

// Wrapper with ToastProvider
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <ToastProvider>{children}</ToastProvider>
);

describe("GroupQRCode", () => {
    const defaultProps = {
        groupId: "group-123",
        groupName: "Test Group",
        inviteCode: "TESTCODE",
        isAdmin: true,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("renders QR code component", () => {
        render(<GroupQRCode {...defaultProps} />, { wrapper: TestWrapper });

        expect(screen.getByTestId("qr-code")).toBeInTheDocument();
    });

    it("displays the invite code in input", () => {
        render(<GroupQRCode {...defaultProps} />, { wrapper: TestWrapper });

        expect(screen.getByDisplayValue("TESTCODE")).toBeInTheDocument();
    });

    it("shows regenerate button for admins", () => {
        render(<GroupQRCode {...defaultProps} isAdmin={true} />, { wrapper: TestWrapper });

        expect(screen.getByText("Regenerate Invite Code")).toBeInTheDocument();
    });

    it("hides regenerate button for non-admins", () => {
        render(<GroupQRCode {...defaultProps} isAdmin={false} />, { wrapper: TestWrapper });

        expect(screen.queryByText("Regenerate Invite Code")).not.toBeInTheDocument();
    });

    it("regenerates invite code when button clicked", async () => {
        const user = userEvent.setup();
        (groupsService.regenerateInviteCode as jest.Mock).mockResolvedValue({
            success: true,
            inviteCode: "NEWCODE1",
        });

        render(<GroupQRCode {...defaultProps} />, { wrapper: TestWrapper });

        await user.click(screen.getByText("Regenerate Invite Code"));

        await waitFor(() => {
            expect(groupsService.regenerateInviteCode).toHaveBeenCalledWith("group-123");
        });
    });

    it("shows download and share buttons", () => {
        render(<GroupQRCode {...defaultProps} />, { wrapper: TestWrapper });

        expect(screen.getByText("Download")).toBeInTheDocument();
        expect(screen.getByText("Share")).toBeInTheDocument();
    });

    it("shows instructions on how to join", () => {
        render(<GroupQRCode {...defaultProps} />, { wrapper: TestWrapper });

        expect(screen.getByText(/Members can scan this QR code/)).toBeInTheDocument();
    });

    it("has copy button for invite code", () => {
        render(<GroupQRCode {...defaultProps} />, { wrapper: TestWrapper });

        // Find copy button by title attribute
        const copyCodeButton = screen.getByTitle("Copy code");
        expect(copyCodeButton).toBeInTheDocument();
    });

    it("has copy button for invite link", () => {
        render(<GroupQRCode {...defaultProps} />, { wrapper: TestWrapper });

        // Find copy link button by title attribute
        const copyLinkButton = screen.getByTitle("Copy link");
        expect(copyLinkButton).toBeInTheDocument();
    });

    it("has invite link input field", () => {
        render(<GroupQRCode {...defaultProps} />, { wrapper: TestWrapper });

        // The join URL should contain the invite code
        const inputs = screen.getAllByRole("textbox");
        const hasInviteLink = inputs.some(input =>
            (input as HTMLInputElement).value.includes("TESTCODE")
        );
        expect(hasInviteLink).toBe(true);
    });
});
