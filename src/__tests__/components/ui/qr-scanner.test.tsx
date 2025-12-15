import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QRScanner } from "@/components/ui/qr-scanner";

// Create mock functions
const mockStart = jest.fn().mockResolvedValue(undefined);
const mockStop = jest.fn().mockResolvedValue(undefined);
const mockClear = jest.fn();
const mockGetCameras = jest.fn();

// Mock html5-qrcode properly including static method
jest.mock("html5-qrcode", () => ({
    Html5Qrcode: Object.assign(
        jest.fn().mockImplementation(() => ({
            start: mockStart,
            stop: mockStop,
            clear: mockClear,
        })),
        {
            getCameras: () => mockGetCameras(),
        }
    ),
}));

// Mock navigator.mediaDevices
const mockGetUserMedia = jest.fn();
Object.defineProperty(navigator, "mediaDevices", {
    value: {
        getUserMedia: mockGetUserMedia,
    },
    configurable: true,
});

describe("QRScanner", () => {
    const mockOnScan = jest.fn();
    const mockOnError = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        mockGetUserMedia.mockResolvedValue({
            getTracks: () => [{ stop: jest.fn() }],
        });
        mockGetCameras.mockResolvedValue([
            { id: "camera-1", label: "Front Camera" },
        ]);
    });

    it("renders idle state with start button", () => {
        render(<QRScanner onScan={mockOnScan} />);

        expect(screen.getByText("Tap to start camera")).toBeInTheDocument();
        expect(screen.getByText("Start Camera")).toBeInTheDocument();
    });

    it("has scanner container element in DOM", () => {
        render(<QRScanner onScan={mockOnScan} />);

        const container = document.getElementById("qr-video-container");
        expect(container).toBeInTheDocument();
    });

    it("scanner container is hidden initially", () => {
        render(<QRScanner onScan={mockOnScan} />);

        const container = document.getElementById("qr-video-container");
        expect(container).toHaveStyle({ display: "none" });
    });

    it("shows starting state when camera is initializing", async () => {
        const user = userEvent.setup();
        
        // Make start hang to see the loading state
        mockStart.mockImplementation(() => new Promise(() => {}));

        render(<QRScanner onScan={mockOnScan} />);

        await user.click(screen.getByText("Start Camera"));

        await waitFor(() => {
            expect(screen.getByText("Starting camera...")).toBeInTheDocument();
        });
    });

    it("requests camera permission when starting", async () => {
        const user = userEvent.setup();

        render(<QRScanner onScan={mockOnScan} />);

        await user.click(screen.getByText("Start Camera"));

        await waitFor(() => {
            expect(mockGetUserMedia).toHaveBeenCalled();
        });
    });

    it("shows error when no cameras found", async () => {
        const user = userEvent.setup();
        mockGetCameras.mockResolvedValue([]);

        render(<QRScanner onScan={mockOnScan} onError={mockOnError} />);

        await user.click(screen.getByText("Start Camera"));

        await waitFor(() => {
            expect(screen.getByText(/No cameras found/)).toBeInTheDocument();
        });
    });

    it("shows try again button after error", async () => {
        const user = userEvent.setup();
        mockGetCameras.mockResolvedValue([]);

        render(<QRScanner onScan={mockOnScan} />);

        await user.click(screen.getByText("Start Camera"));

        await waitFor(() => {
            expect(screen.getByText("Try Again")).toBeInTheDocument();
        });
    });

    it("calls onError callback when error occurs", async () => {
        const user = userEvent.setup();
        mockGetCameras.mockResolvedValue([]);

        render(<QRScanner onScan={mockOnScan} onError={mockOnError} />);

        await user.click(screen.getByText("Start Camera"));

        await waitFor(() => {
            expect(mockOnError).toHaveBeenCalled();
        });
    });
});
