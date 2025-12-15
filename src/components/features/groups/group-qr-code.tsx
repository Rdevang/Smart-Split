"use client";

import { useState, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
    Copy,
    Check,
    Download,
    Share2,
    RefreshCw,
    QrCode,
    Link as LinkIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { groupsService } from "@/services/groups";

interface GroupQRCodeProps {
    groupId: string;
    groupName: string;
    inviteCode: string;
    isAdmin: boolean;
}

export function GroupQRCode({ groupId, groupName, inviteCode, isAdmin }: GroupQRCodeProps) {
    const toast = useToast();
    const [code, setCode] = useState(inviteCode);
    const [copied, setCopied] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const qrRef = useRef<HTMLDivElement>(null);

    const siteUrl = typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const joinUrl = `${siteUrl}/groups/join?code=${code}`;

    const copyCode = async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        toast.success("Invite code copied!");
        setTimeout(() => setCopied(false), 2000);
    };

    const copyLink = async () => {
        await navigator.clipboard.writeText(joinUrl);
        setCopiedLink(true);
        toast.success("Invite link copied!");
        setTimeout(() => setCopiedLink(false), 2000);
    };

    const downloadQRCode = () => {
        if (!qrRef.current) return;

        const svg = qrRef.current.querySelector("svg");
        if (!svg) return;

        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const img = new Image();

        img.onload = () => {
            canvas.width = img.width * 2;
            canvas.height = img.height * 2;
            if (ctx) {
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            }

            const pngUrl = canvas.toDataURL("image/png");
            const downloadLink = document.createElement("a");
            downloadLink.href = pngUrl;
            downloadLink.download = `${groupName.replace(/\s+/g, "-")}-invite-qr.png`;
            downloadLink.click();
        };

        img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
    };

    const shareQRCode = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Join ${groupName} on Smart Split`,
                    text: `Join my expense group "${groupName}" using this invite code: ${code}`,
                    url: joinUrl,
                });
            } catch {
                // User cancelled or share failed, fallback to copy
                copyLink();
            }
        } else {
            copyLink();
        }
    };

    const regenerateCode = async () => {
        if (!isAdmin) return;

        setIsRegenerating(true);
        try {
            const result = await groupsService.regenerateInviteCode(groupId);
            if (result.success && result.inviteCode) {
                setCode(result.inviteCode);
                toast.success("New invite code generated!");
            } else {
                toast.error(result.error || "Failed to regenerate code");
            }
        } finally {
            setIsRegenerating(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <QrCode className="h-5 w-5" />
                    Invite via QR Code
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* QR Code Display */}
                <div className="flex justify-center">
                    <div
                        ref={qrRef}
                        className="rounded-2xl bg-white p-4 shadow-inner"
                    >
                        <QRCodeSVG
                            value={joinUrl}
                            size={180}
                            level="M"
                            includeMargin={false}
                            bgColor="#ffffff"
                            fgColor="#0d9488"
                        />
                    </div>
                </div>

                {/* Invite Code Display */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Invite Code
                    </label>
                    <div className="flex gap-2">
                        <Input
                            value={code}
                            readOnly
                            className="font-mono text-center text-lg tracking-widest"
                        />
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={copyCode}
                            title="Copy code"
                        >
                            {copied ? (
                                <Check className="h-4 w-4 text-green-500" />
                            ) : (
                                <Copy className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </div>

                {/* Invite Link */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Invite Link
                    </label>
                    <div className="flex gap-2">
                        <Input
                            value={joinUrl}
                            readOnly
                            className="text-xs"
                        />
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={copyLink}
                            title="Copy link"
                        >
                            {copiedLink ? (
                                <Check className="h-4 w-4 text-green-500" />
                            ) : (
                                <LinkIcon className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2">
                    <Button
                        variant="outline"
                        onClick={downloadQRCode}
                        className="text-sm"
                    >
                        <Download className="mr-2 h-4 w-4" />
                        Download
                    </Button>
                    <Button
                        variant="outline"
                        onClick={shareQRCode}
                        className="text-sm"
                    >
                        <Share2 className="mr-2 h-4 w-4" />
                        Share
                    </Button>
                </div>

                {/* Regenerate Button (Admin Only) */}
                {isAdmin && (
                    <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
                        <Button
                            variant="ghost"
                            onClick={regenerateCode}
                            disabled={isRegenerating}
                            className="w-full text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                        >
                            <RefreshCw className={`mr-2 h-4 w-4 ${isRegenerating ? "animate-spin" : ""}`} />
                            {isRegenerating ? "Regenerating..." : "Regenerate Invite Code"}
                        </Button>
                        <p className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
                            This will invalidate the current code
                        </p>
                    </div>
                )}

                {/* Instructions */}
                <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                        <strong>How to join:</strong> Members can scan this QR code with their phone camera,
                        or enter the invite code manually at{" "}
                        <span className="font-mono text-teal-600 dark:text-teal-400">
                            {siteUrl}/groups/join
                        </span>
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

