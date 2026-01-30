"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, CameraOff, RefreshCw, SwitchCamera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { log } from "@/lib/console-logger";

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

    // Get cameras
    const getCameras = useCallback(async (): Promise<CameraDevice[]> => {
        try {
            // Request permission first
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                stream.getTracks().forEach(track => track.stop());
            } catch {
                // Permission might be denied
            }

            const devices = await Html5Qrcode.getCameras();
            if (devices && devices.length > 0) {
                const cameraList = devices.map((d, i) => ({
                    id: d.id,
                    label: d.label || `Camera ${i + 1}`
                }));
                setCameras(cameraList);

                // Find back camera for mobile
                const backCameraIndex = devices.findIndex(d =>
                    d.label.toLowerCase().includes("back") ||
                    d.label.toLowerCase().includes("rear") ||
                    d.label.toLowerCase().includes("environment")
                );
                if (backCameraIndex !== -1) {
                    setSelectedCameraIndex(backCameraIndex);
                    return cameraList;
                }

                // Default to first camera (usually front on laptop, which is fine)
                setSelectedCameraIndex(0);
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

        // Stop existing scanner
        if (scannerRef.current) {
            try { await scannerRef.current.stop(); } catch { /* ignore */ }
            try { scannerRef.current.clear(); } catch { /* ignore */ }
            scannerRef.current = null;
        }

        // Wait for cleanup
        await new Promise(resolve => setTimeout(resolve, 300));

        try {
            // Get cameras if needed
            let availableCameras = cameras;
            if (cameras.length === 0) {
                availableCameras = await getCameras();
            }

            if (availableCameras.length === 0) {
                throw new Error("No cameras found. Please ensure camera access is allowed.");
            }

            const targetCameraId = cameraId || availableCameras[selectedCameraIndex]?.id || availableCameras[0]?.id;

            // Create new scanner
            const scanner = new Html5Qrcode("qr-video-container", {
                verbose: false,
                experimentalFeatures: {
                    useBarCodeDetectorIfSupported: true
                }
            });
            scannerRef.current = scanner;

            // Start with video constraints
            await scanner.start(
                targetCameraId,
                {
                    fps: 15,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0,
                    videoConstraints: {
                        deviceId: targetCameraId,
                        facingMode: { ideal: "environment" },
                        width: { min: 300, ideal: 640, max: 1920 },
                        height: { min: 300, ideal: 480, max: 1080 }
                    }
                },
                (decodedText) => {
                    // Parse QR code
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
                () => { /* QR not found - ignore */ }
            );

            if (mountedRef.current) {
                setStatus("scanning");
            }
        } catch (err) {
            log.error("QRScanner", "Failed to start scanner", err);
            if (mountedRef.current) {
                setStatus("idle");
                const msg = err instanceof Error ? err.message : String(err);

                if (msg.includes("NotAllowed") || msg.includes("Permission")) {
                    setError("Camera permission denied. Please allow camera access in browser settings.");
                } else if (msg.includes("NotFound") || msg.includes("no camera")) {
                    setError("No camera found on this device.");
                } else if (msg.includes("NotReadable") || msg.includes("in use")) {
                    setError("Camera is in use by another app. Close other apps and try again.");
                } else {
                    setError(msg || "Failed to start camera");
                }
                onError?.(msg);
            }
        }
    }, [cameras, selectedCameraIndex, getCameras, stopScanner, onScan, onError]);

    // Switch camera
    const switchCamera = useCallback(async () => {
        if (cameras.length <= 1) return;
        const nextIndex = (selectedCameraIndex + 1) % cameras.length;
        setSelectedCameraIndex(nextIndex);
        await startScanner(cameras[nextIndex].id);
    }, [cameras, selectedCameraIndex, startScanner]);

    // Cleanup
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (scannerRef.current) {
                scannerRef.current.stop().catch(() => { });
            }
        };
    }, []);

    const isIdle = status === "idle";
    const isStarting = status === "starting";
    const isScanning = status === "scanning";

    return (
        <div className="space-y-3">
            {/* Scanner container */}
            <div className="relative overflow-hidden rounded-xl bg-black">
                {/* Video container */}
                <div
                    id="qr-video-container"
                    style={{
                        width: "100%",
                        minHeight: isIdle ? "0px" : "280px",
                        display: isIdle ? "none" : "block",
                        position: "relative"
                    }}
                />

                {/* Idle state */}
                {isIdle && (
                    <div
                        className="flex flex-col items-center justify-center p-6 sm:p-8"
                        style={{ minHeight: "250px" }}
                    >
                        <Camera className="h-10 w-10 sm:h-12 sm:w-12 text-gray-500" />
                        <p className="mt-3 text-center text-sm text-gray-400">
                            Tap to start camera
                        </p>
                        <Button onClick={() => startScanner()} className="mt-4" size="sm">
                            <Camera className="mr-2 h-4 w-4" />
                            Start Camera
                        </Button>
                    </div>
                )}

                {/* Starting state */}
                {isStarting && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20">
                        <RefreshCw className="h-10 w-10 animate-spin text-teal-500" />
                        <p className="mt-3 text-sm text-gray-300">Starting camera...</p>
                    </div>
                )}

                {/* Scanning controls */}
                {isScanning && (
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2 z-20">
                        {cameras.length > 1 && (
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={switchCamera}
                                className="bg-black/70 text-white hover:bg-black/90 text-xs"
                            >
                                <SwitchCamera className="mr-1.5 h-3.5 w-3.5" />
                                Switch
                            </Button>
                        )}
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={stopScanner}
                            className="bg-black/70 text-white hover:bg-black/90 text-xs"
                        >
                            <CameraOff className="mr-1.5 h-3.5 w-3.5" />
                            Stop
                        </Button>
                    </div>
                )}
            </div>

            {/* Global styles for html5-qrcode elements */}
            <style dangerouslySetInnerHTML={{
                __html: `
                #qr-video-container video {
                    width: 100% !important;
                    height: auto !important;
                    min-height: 250px !important;
                    max-height: 350px !important;
                    object-fit: cover !important;
                    display: block !important;
                }
                #qr-video-container img[alt="Info icon"],
                #qr-video-container img[alt="Camera based scan"] {
                    display: none !important;
                }
                #qr-video-container > div {
                    border: none !important;
                }
                @media (max-width: 640px) {
                    #qr-video-container video {
                        min-height: 220px !important;
                        max-height: 280px !important;
                    }
                }
            `}} />

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
                    {cameras[selectedCameraIndex]?.label}
                    {cameras.length > 1 && ` • ${cameras.length} cameras available`}
                </p>
            )}
        </div>
    );
}
