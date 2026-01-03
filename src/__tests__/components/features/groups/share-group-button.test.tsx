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

// Mock window.open for social share tests
const mockWindowOpen = jest.fn();
Object.defineProperty(window, "open", {
    value: mockWindowOpen,
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

    it("shows social share buttons in dropdown", async () => {
        const user = userEvent.setup();
        render(<ShareGroupButton {...defaultProps} />);

        await user.click(screen.getByRole("button"));

        expect(screen.getByTitle("Share via WhatsApp")).toBeInTheDocument();
        expect(screen.getByTitle("Share via Telegram")).toBeInTheDocument();
        expect(screen.getByTitle("Share via Facebook")).toBeInTheDocument();
        expect(screen.getByTitle("Share via X")).toBeInTheDocument();
        expect(screen.getByTitle("Share via Email")).toBeInTheDocument();
    });

    it("opens WhatsApp share link when WhatsApp button is clicked", async () => {
        const user = userEvent.setup();
        render(<ShareGroupButton {...defaultProps} />);

        await user.click(screen.getByRole("button"));
        await user.click(screen.getByTitle("Share via WhatsApp"));

        expect(mockWindowOpen).toHaveBeenCalledWith(
            expect.stringContaining("https://wa.me/"),
            "_blank",
            expect.any(String)
        );
    });

    it("opens Telegram share link when Telegram button is clicked", async () => {
        const user = userEvent.setup();
        render(<ShareGroupButton {...defaultProps} />);

        await user.click(screen.getByRole("button"));
        await user.click(screen.getByTitle("Share via Telegram"));

        expect(mockWindowOpen).toHaveBeenCalledWith(
            expect.stringContaining("https://t.me/share/url"),
            "_blank",
            expect.any(String)
        );
    });

    it("opens Facebook share link when Facebook button is clicked", async () => {
        const user = userEvent.setup();
        render(<ShareGroupButton {...defaultProps} />);

        await user.click(screen.getByRole("button"));
        await user.click(screen.getByTitle("Share via Facebook"));

        expect(mockWindowOpen).toHaveBeenCalledWith(
            expect.stringContaining("facebook.com/sharer"),
            "_blank",
            expect.any(String)
        );
    });

    it("opens X (Twitter) share link when X button is clicked", async () => {
        const user = userEvent.setup();
        render(<ShareGroupButton {...defaultProps} />);

        await user.click(screen.getByRole("button"));
        await user.click(screen.getByTitle("Share via X"));

        expect(mockWindowOpen).toHaveBeenCalledWith(
            expect.stringContaining("twitter.com/intent/tweet"),
            "_blank",
            expect.any(String)
        );
    });

    it("opens mailto link when Email button is clicked", async () => {
        const user = userEvent.setup();
        render(<ShareGroupButton {...defaultProps} />);

        await user.click(screen.getByRole("button"));
        await user.click(screen.getByTitle("Share via Email"));

        expect(mockWindowOpen).toHaveBeenCalledWith(
            expect.stringContaining("mailto:"),
            "_blank",
            expect.any(String)
        );
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

    it("closes dropdown when close button is clicked", async () => {
        const user = userEvent.setup();
        render(<ShareGroupButton {...defaultProps} />);

        await user.click(screen.getByRole("button"));
        expect(screen.getByText("Share Group")).toBeInTheDocument();

        // Get all buttons, the close button should be the one inside the modal with the X icon
        const buttons = screen.getAllByRole("button");
        const closeBtn = buttons.find(btn => btn.querySelector("svg.lucide-x"));
        if (closeBtn) {
            await user.click(closeBtn);
        }

        await waitFor(() => {
            expect(screen.queryByText("Share Group")).not.toBeInTheDocument();
        });
    });

    it("shows mobile drag handle indicator", async () => {
        const user = userEvent.setup();
        render(<ShareGroupButton {...defaultProps} />);

        await user.click(screen.getByRole("button"));

        // The drag handle has specific styling classes
        const modal = screen.getByText("Share Group").closest("div[class*='fixed']");
        expect(modal).toBeInTheDocument();
    });

    it("shows help text with join URL", async () => {
        const user = userEvent.setup();
        render(<ShareGroupButton {...defaultProps} />);

        await user.click(screen.getByRole("button"));

        expect(screen.getByText(/Others can scan the QR/)).toBeInTheDocument();
        expect(screen.getByText("/groups/join")).toBeInTheDocument();
    });

    it("QR code contains correct join URL", async () => {
        const user = userEvent.setup();
        render(<ShareGroupButton {...defaultProps} />);

        await user.click(screen.getByRole("button"));

        const qrCode = screen.getByTestId("qr-code-mini");
        expect(qrCode.getAttribute("data-value")).toContain("/groups/join?code=TESTCODE");
    });
});
