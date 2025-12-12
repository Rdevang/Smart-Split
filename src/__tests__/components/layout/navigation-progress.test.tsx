import { render, screen, renderHook, act } from "@testing-library/react";
import { Suspense } from "react";
import {
    NavigationProgressProvider,
    useNavigationProgress
} from "@/components/layout/navigation-progress";

// Mock usePathname and useSearchParams
jest.mock("next/navigation", () => ({
    usePathname: jest.fn(() => "/"),
    useSearchParams: jest.fn(() => new URLSearchParams()),
}));

// Wrapper that includes Suspense for useSearchParams
function TestWrapper({ children }: { children: React.ReactNode }) {
    return (
        <Suspense fallback={null}>
            <NavigationProgressProvider>{children}</NavigationProgressProvider>
        </Suspense>
    );
}

describe("NavigationProgressProvider", () => {
    it("renders children", () => {
        render(
            <TestWrapper>
                <div data-testid="child">Child Content</div>
            </TestWrapper>
        );
        expect(screen.getByTestId("child")).toBeInTheDocument();
    });

    it("renders progress bar element", () => {
        const { container } = render(
            <TestWrapper>
                <div>Content</div>
            </TestWrapper>
        );
        // Progress bar should exist
        const progressBar = container.querySelector(".fixed.left-0.top-0");
        expect(progressBar).toBeInTheDocument();
    });

    it("progress bar has correct base styles", () => {
        const { container } = render(
            <TestWrapper>
                <div>Content</div>
            </TestWrapper>
        );
        const progressBar = container.querySelector(".fixed.left-0.top-0");
        expect(progressBar).toHaveClass("bg-teal-500");
        expect(progressBar).toHaveClass("h-0.5");
        expect(progressBar).toHaveClass("z-[9999]");
        expect(progressBar).toHaveClass("transition-all");
    });

    it("progress bar is initially hidden", () => {
        const { container } = render(
            <TestWrapper>
                <div>Content</div>
            </TestWrapper>
        );
        const progressBar = container.querySelector(".fixed.left-0.top-0");
        expect(progressBar).toHaveClass("opacity-0");
    });
});

describe("useNavigationProgress", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper>{children}</TestWrapper>
    );

    it("throws error when used outside provider", () => {
        const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => { });

        expect(() => {
            renderHook(() => useNavigationProgress());
        }).toThrow("useNavigationProgress must be used within NavigationProgressProvider");

        consoleSpy.mockRestore();
    });

    it("returns start, done, and isNavigating", () => {
        const { result } = renderHook(() => useNavigationProgress(), { wrapper });

        expect(result.current).toHaveProperty("start");
        expect(result.current).toHaveProperty("done");
        expect(result.current).toHaveProperty("isNavigating");
    });

    it("start and done are functions", () => {
        const { result } = renderHook(() => useNavigationProgress(), { wrapper });

        expect(typeof result.current.start).toBe("function");
        expect(typeof result.current.done).toBe("function");
    });

    it("isNavigating is initially false", () => {
        const { result } = renderHook(() => useNavigationProgress(), { wrapper });

        expect(result.current.isNavigating).toBe(false);
    });

    it("start() can be called without error", () => {
        const { result } = renderHook(() => useNavigationProgress(), { wrapper });

        expect(() => {
            act(() => {
                result.current.start();
            });
        }).not.toThrow();
    });

    it("done() can be called without error", () => {
        const { result } = renderHook(() => useNavigationProgress(), { wrapper });

        expect(() => {
            act(() => {
                result.current.done();
            });
        }).not.toThrow();
    });

    it("start() and done() can be called in sequence", () => {
        const { result } = renderHook(() => useNavigationProgress(), { wrapper });

        expect(() => {
            act(() => {
                result.current.start();
                result.current.done();
            });
        }).not.toThrow();
    });

    it("start function is stable across renders", () => {
        const { result, rerender } = renderHook(() => useNavigationProgress(), { wrapper });

        const startFn = result.current.start;
        rerender();

        expect(result.current.start).toBe(startFn);
    });

    it("done function is stable across renders", () => {
        const { result, rerender } = renderHook(() => useNavigationProgress(), { wrapper });

        const doneFn = result.current.done;
        rerender();

        expect(result.current.done).toBe(doneFn);
    });
});
