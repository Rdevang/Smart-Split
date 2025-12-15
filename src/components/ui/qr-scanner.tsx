"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, CameraOff, RefreshCw, SwitchCamera } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QRScannerProps {
    onScan: (code: string) => void;
    onError?: (error: string) => void;
}

interface CameraDevice {
    id: string;
    label: string;
}

export function QRScanner({ onScan, onError }: QRScannerProps) {
    const [status, setStatus] = useState<"idle" | "starting" | "scanning">("idle");
    const [error, setError] = useState<string | null>(null);
    const [cameras, setCameras] = useState<CameraDevice[]>([]);
    const [selectedCameraIndex, setSelectedCameraIndex] = useState(0);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const mountedRef = useRef(true);

    // Request camera permission
    const requestCameraPermission = async (): Promise<boolean> => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" }
            });
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                stream.getTracks().forEach(track => track.stop());
                return true;
            } catch {
                return false;
            }
        }
    };

    // Get cameras
    const getCameras = useCallback(async (): Promise<CameraDevice[]> => {
        try {
            const devices = await Html5Qrcode.getCameras();
            if (devices && devices.length > 0) {
                const cameraList = devices.map((d, i) => ({
                    id: d.id,
                    label: d.label || `Camera ${i + 1}`
                }));
                setCameras(cameraList);

                const backCameraIndex = devices.findIndex(d =>
                    d.label.toLowerCase().includes("back") ||
                    d.label.toLowerCase().includes("rear")
                );
                if (backCameraIndex !== -1) {
                    setSelectedCameraIndex(backCameraIndex);
                }
                return cameraList;
            }
            return [];
        } catch {
            return [];
        }
    }, []);

    // Stop scanner
    const stopScanner = useCallback(async () => {
        if (scannerRef.current) {
            try { await scannerRef.current.stop(); } catch { /* ignore */ }
            try { scannerRef.current.clear(); } catch { /* ignore */ }
            scannerRef.current = null;
        }
        if (mountedRef.current) {
            setStatus("idle");
        }
    }, []);

    // Start scanner
    const startScanner = useCallback(async (cameraId?: string) => {
        setError(null);
        setStatus("starting");

        await stopScanner();

        // Wait for DOM and state to settle
        await new Promise(resolve => setTimeout(resolve, 200));

        try {
            const hasPermission = await requestCameraPermission();
            if (!hasPermission) {
                throw new Error("Camera permission denied. Please allow camera access.");
            }

            let availableCameras = cameras;
            if (cameras.length === 0) {
                availableCameras = await getCameras();
            }

            if (availableCameras.length === 0) {
                throw new Error("No cameras found on this device.");
            }

            // Make sure element exists
            const element = document.getElementById("qr-scanner-region");
            if (!element) {
                throw new Error("Scanner region not ready. Please try again.");
            }

            // Clear any existing content
            element.innerHTML = "";

            const scanner = new Html5Qrcode("qr-scanner-region");
            scannerRef.current = scanner;

            const targetCameraId = cameraId || availableCameras[selectedCameraIndex]?.id || availableCameras[0]?.id;

            await scanner.start(
                targetCameraId,
                { fps: 10, qrbox: 200 },
                (decodedText) => {
                    let code = decodedText;
                    try {
                        const url = new URL(decodedText);
                        const codeParam = url.searchParams.get("code");
                        if (codeParam) code = codeParam;
                    } catch {
                        if (code.length > 8) code = code.slice(-8);
                    }
                    stopScanner();
                    onScan(code.toUpperCase());
                },
                () => { }
            );

            if (mountedRef.current) {
                setStatus("scanning");
            }
        } catch (err) {
            if (mountedRef.current) {
                setStatus("idle");
                const msg = err instanceof Error ? err.message : String(err);
                setError(msg);
                onError?.(msg);
            }
        }
    }, [cameras, selectedCameraIndex, getCameras, stopScanner, onScan, onError]);

    // Switch camera
    const switchCamera = useCallback(async () => {
        if (cameras.length <= 1) return;
        const nextIndex = (selectedCameraIndex + 1) % cameras.length;
        setSelectedCameraIndex(nextIndex);
        if (status === "scanning") {
            await startScanner(cameras[nextIndex].id);
        }
    }, [cameras, selectedCameraIndex, status, startScanner]);

    // Cleanup
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (scannerRef.current) {
                try { scannerRef.current.stop(); } catch { /* ignore */ }
                try { scannerRef.current.clear(); } catch { /* ignore */ }
            }
        };
    }, []);

    const isIdle = status === "idle";
    const isStarting = status === "starting";
    const isScanning = status === "scanning";

    return (
        <div className="space-y-4">
            {/* Main scanner container */}
            <div className="relative overflow-hidden rounded-xl bg-gray-900" style={{ minHeight: "300px" }}>

                {/* Scanner region - ALWAYS in DOM */}
                <div
                    id="qr-scanner-region"
                    style={{
                        width: "100%",
                        minHeight: isIdle ? "0" : "300px",
                        display: isIdle ? "none" : "block"
                    }}
                />

                {/* Idle overlay */}
                {isIdle && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
                        <Camera className="h-12 w-12 text-gray-500" />
                        <p className="mt-4 text-center text-sm text-gray-400">
                            Scan a QR code to join a group
                        </p>
                        <Button onClick={() => startScanner()} className="mt-4">
                            <Camera className="mr-2 h-4 w-4" />
                            Start Camera
                        </Button>
                    </div>
                )}

                {/* Starting overlay */}
                {isStarting && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900">
                        <RefreshCw className="h-12 w-12 animate-spin text-teal-500" />
                        <p className="mt-4 text-sm text-gray-400">Starting camera...</p>
                        <p className="mt-2 text-xs text-gray-500">Allow camera access if prompted</p>
                    </div>
                )}

                {/* Scanning controls */}
                {isScanning && (
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-10">
                        {cameras.length > 1 && (
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={switchCamera}
                                className="bg-black/60 backdrop-blur-sm hover:bg-black/80"
                            >
                                <SwitchCamera className="mr-2 h-4 w-4" />
                                Switch
                            </Button>
                        )}
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={stopScanner}
                            className="bg-black/60 backdrop-blur-sm hover:bg-black/80"
                        >
                            <CameraOff className="mr-2 h-4 w-4" />
                            Stop
                        </Button>
                    </div>
                )}
            </div>

            {/* Error message */}
            {error && (
                <div className="space-y-3 rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setError(null); startScanner(); }}
                        className="w-full"
                    >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Try Again
                    </Button>
                </div>
            )}

            {/* Camera info */}
            {isScanning && cameras.length > 0 && (
                <p className="text-center text-xs text-gray-500">
                    Using: {cameras[selectedCameraIndex]?.label}
                    {cameras.length > 1 && ` • Tap Switch to change camera`}
                </p>
            )}
        </div>
    );
}
