import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShareGroupButton } from "@/components/features/groups/share-group-button";

// Mock QRCodeSVG
jest.mock("qrcode.react", () => ({
    QRCodeSVG: ({ value }: { value: string }) => (
        <div data-testid="qr-code-mini" data-value={value}>
            QR
        </div>
    ),
}));

// Mock clipboard API
const mockWriteText = jest.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, "clipboard", {
    value: { writeText: mockWriteText },
    configurable: true,
});

describe("ShareGroupButton", () => {
    const defaultProps = {
        groupId: "group-123",
        groupName: "Test Group",
        inviteCode: "TESTCODE",
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("renders share button", () => {
        render(<ShareGroupButton {...defaultProps} />);

        expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("opens dropdown when clicked", async () => {
        const user = userEvent.setup();
        render(<ShareGroupButton {...defaultProps} />);

        await user.click(screen.getByRole("button"));

        expect(screen.getByText("Share Group")).toBeInTheDocument();
    });

    it("shows QR code in dropdown", async () => {
        const user = userEvent.setup();
        render(<ShareGroupButton {...defaultProps} />);

        await user.click(screen.getByRole("button"));

        expect(screen.getByTestId("qr-code-mini")).toBeInTheDocument();
    });

    it("shows invite code in dropdown", async () => {
        const user = userEvent.setup();
        render(<ShareGroupButton {...defaultProps} />);

        await user.click(screen.getByRole("button"));

        expect(screen.getByText("TESTCODE")).toBeInTheDocument();
    });

    it("shows copy link button in dropdown", async () => {
        const user = userEvent.setup();
        render(<ShareGroupButton {...defaultProps} />);

        await user.click(screen.getByRole("button"));

        expect(screen.getByText("Copy Link")).toBeInTheDocument();
    });

    it("closes dropdown when clicking outside", async () => {
        const user = userEvent.setup();
        render(
            <div>
                <ShareGroupButton {...defaultProps} />
                <div data-testid="outside">Outside</div>
            </div>
        );

        await user.click(screen.getByRole("button"));
        expect(screen.getByText("Share Group")).toBeInTheDocument();

        await user.click(screen.getByTestId("outside"));

        await waitFor(() => {
            expect(screen.queryByText("Share Group")).not.toBeInTheDocument();
        });
    });
});
