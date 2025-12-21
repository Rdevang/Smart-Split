"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, X, RotateCcw, Check, SwitchCamera } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface CameraCaptureProps {
    onCapture: (file: File) => void;
    onClose: () => void;
    isOpen: boolean;
}

export function CameraCapture({ onCapture, onClose, isOpen }: CameraCaptureProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

    const startCamera = useCallback(async (facing: "user" | "environment") => {
        setIsLoading(true);
        setError(null);

        // Stop any existing stream
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: facing,
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
                audio: false,
            });

            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }

            setIsLoading(false);
        } catch (err) {
            console.error("Camera error:", err);
            setError(
                err instanceof Error && err.name === "NotAllowedError"
                    ? "Camera access denied. Please allow camera access in your browser settings."
                    : "Unable to access camera. Please make sure you have a camera connected."
            );
            setIsLoading(false);
        }
    }, []);

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            startCamera(facingMode);
        } else {
            stopCamera();
            setCapturedImage(null);
        }

        return () => {
            stopCamera();
        };
    }, [isOpen, facingMode, startCamera, stopCamera]);

    const handleCapture = () => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");

        if (!context) return;

        // Set canvas size to video size
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw the current video frame
        // Mirror the image if using front camera
        if (facingMode === "user") {
            context.translate(canvas.width, 0);
            context.scale(-1, 1);
        }
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Get the image data URL
        const imageDataUrl = canvas.toDataURL("image/jpeg", 0.9);
        setCapturedImage(imageDataUrl);

        // Stop camera preview
        stopCamera();
    };

    const handleRetake = () => {
        setCapturedImage(null);
        startCamera(facingMode);
    };

    const handleConfirm = () => {
        if (!capturedImage) return;

        // Convert data URL to File without using fetch (CSP-safe)
        const [header, base64Data] = capturedImage.split(",");
        const mimeMatch = header.match(/:(.*?);/);
        const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

        // Decode base64 to binary
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        const blob = new Blob([bytes], { type: mimeType });
        const file = new File([blob], `camera-photo-${Date.now()}.jpg`, { type: mimeType });

        onCapture(file);
        onClose();
    };

    const handleSwitchCamera = () => {
        setFacingMode(prev => prev === "user" ? "environment" : "user");
    };

    const handleClose = () => {
        stopCamera();
        setCapturedImage(null);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-gray-900">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
                    <h3 className="text-lg font-semibold text-white">Take Photo</h3>
                    <button
                        onClick={handleClose}
                        className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Camera / Preview area */}
                <div className="relative aspect-square bg-black">
                    {/* Loading state */}
                    {isLoading && !capturedImage && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="flex flex-col items-center gap-3">
                                <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
                                <p className="text-sm text-gray-400">Starting camera...</p>
                            </div>
                        </div>
                    )}

                    {/* Error state */}
                    {error && (
                        <div className="absolute inset-0 flex items-center justify-center p-6">
                            <div className="text-center">
                                <Camera className="mx-auto mb-3 h-12 w-12 text-gray-600" />
                                <p className="text-sm text-gray-400">{error}</p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => startCamera(facingMode)}
                                    className="mt-4"
                                >
                                    Try Again
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Video preview */}
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={cn(
                            "h-full w-full object-cover",
                            facingMode === "user" && "-scale-x-100", // Mirror for selfie
                            (isLoading || error || capturedImage) && "hidden"
                        )}
                    />

                    {/* Captured image preview */}
                    {capturedImage && (
                        <img
                            src={capturedImage}
                            alt="Captured"
                            className="h-full w-full object-cover"
                        />
                    )}

                    {/* Hidden canvas for capturing */}
                    <canvas ref={canvasRef} className="hidden" />

                    {/* Circular crop guide overlay */}
                    {!capturedImage && !error && !isLoading && (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                            <div className="h-64 w-64 rounded-full border-2 border-white/50 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-4 bg-gray-900 px-4 py-6">
                    {capturedImage ? (
                        <>
                            <Button
                                variant="outline"
                                onClick={handleRetake}
                                className="border-gray-700 text-gray-300 hover:bg-gray-800"
                            >
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Retake
                            </Button>
                            <Button onClick={handleConfirm}>
                                <Check className="mr-2 h-4 w-4" />
                                Use Photo
                            </Button>
                        </>
                    ) : (
                        <>
                            {/* Switch camera button */}
                            <button
                                onClick={handleSwitchCamera}
                                disabled={isLoading || !!error}
                                className="rounded-full p-3 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white disabled:opacity-50"
                            >
                                <SwitchCamera className="h-6 w-6" />
                            </button>

                            {/* Capture button */}
                            <button
                                onClick={handleCapture}
                                disabled={isLoading || !!error}
                                className="group relative flex h-16 w-16 items-center justify-center rounded-full bg-white transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
                            >
                                <div className="h-14 w-14 rounded-full border-4 border-gray-900 transition-colors group-hover:border-teal-600" />
                            </button>

                            {/* Spacer for alignment */}
                            <div className="w-12" />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

