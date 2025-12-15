"use client";

import { useState, useRef, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Share2, Copy, Check, QrCode, Link as LinkIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ShareGroupButtonProps {
    groupId: string;
    groupName: string;
    inviteCode: string;
}

export function ShareGroupButton({ groupId, groupName, inviteCode }: ShareGroupButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState<"code" | "link" | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const siteUrl = typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const joinUrl = `${siteUrl}/groups/join?code=${inviteCode}`;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    const copyToClipboard = async (text: string, type: "code" | "link") => {
        await navigator.clipboard.writeText(text);
        setCopied(type);
        setTimeout(() => setCopied(null), 2000);
    };

    const handleNativeShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Join ${groupName} on Smart Split`,
                    text: `Join my expense group "${groupName}" using code: ${inviteCode}`,
                    url: joinUrl,
                });
                setIsOpen(false);
            } catch {
                // User cancelled share
            }
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <Button
                variant="outline"
                size="icon"
                onClick={() => setIsOpen(!isOpen)}
                title="Share group"
            >
                <Share2 className="h-4 w-4" />
            </Button>

            {isOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                    {/* Header */}
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                            Share Group
                        </h3>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                            <X className="h-4 w-4 text-gray-500" />
                        </button>
                    </div>

                    {/* QR Code */}
                    <div className="mb-4 flex justify-center">
                        <div className="rounded-xl bg-white p-3 shadow-inner dark:bg-gray-100">
                            <QRCodeSVG
                                value={joinUrl}
                                size={120}
                                level="M"
                                bgColor="#ffffff"
                                fgColor="#0d9488"
                            />
                        </div>
                    </div>

                    {/* Invite Code */}
                    <div className="mb-3">
                        <div className="flex items-center gap-2">
                            <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-600 dark:bg-gray-700">
                                <QrCode className="h-4 w-4 text-gray-400" />
                                <span className="flex-1 font-mono text-sm tracking-wider text-gray-900 dark:text-white">
                                    {inviteCode}
                                </span>
                            </div>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => copyToClipboard(inviteCode, "code")}
                                className="shrink-0"
                            >
                                {copied === "code" ? (
                                    <Check className="h-4 w-4 text-green-500" />
                                ) : (
                                    <Copy className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(joinUrl, "link")}
                            className="flex-1 text-xs"
                        >
                            {copied === "link" ? (
                                <Check className="mr-1.5 h-3.5 w-3.5 text-green-500" />
                            ) : (
                                <LinkIcon className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Copy Link
                        </Button>
                        {typeof navigator !== "undefined" && "share" in navigator && (
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={handleNativeShare}
                                className="flex-1 text-xs"
                            >
                                <Share2 className="mr-1.5 h-3.5 w-3.5" />
                                Share
                            </Button>
                        )}
                    </div>

                    {/* Help Text */}
                    <p className="mt-3 text-center text-[10px] text-gray-500 dark:text-gray-400">
                        Others can scan the QR or enter the code at{" "}
                        <span className="font-mono text-teal-600 dark:text-teal-400">/groups/join</span>
                    </p>
                </div>
            )}
        </div>
    );
}

