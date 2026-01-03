"use client";

import { useState, useRef, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Share2, Copy, Check, QrCode, Link as LinkIcon, X, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

// Social media icons as SVG components
function WhatsAppIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
    );
}

function FacebookIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
    );
}

function TelegramIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
    );
}

function TwitterIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
    );
}

interface ShareGroupButtonProps {
    groupId: string;
    groupName: string;
    inviteCode: string;
}

interface SocialShareOption {
    name: string;
    icon: React.ReactNode;
    getUrl: (joinUrl: string, text: string) => string;
    color: string;
    hoverColor: string;
}

export function ShareGroupButton({ groupId, groupName, inviteCode }: ShareGroupButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState<"code" | "link" | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const siteUrl = typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const joinUrl = `${siteUrl}/groups/join?code=${inviteCode}`;
    const shareText = `Join my expense group "${groupName}" on Smart Split! Use code: ${inviteCode}`;

    const socialShareOptions: SocialShareOption[] = [
        {
            name: "WhatsApp",
            icon: <WhatsAppIcon className="h-5 w-5" />,
            getUrl: (url, text) => `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`,
            color: "bg-[#25D366]",
            hoverColor: "hover:bg-[#20BD5A]",
        },
        {
            name: "Telegram",
            icon: <TelegramIcon className="h-5 w-5" />,
            getUrl: (url, text) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
            color: "bg-[#0088cc]",
            hoverColor: "hover:bg-[#0077b5]",
        },
        {
            name: "Facebook",
            icon: <FacebookIcon className="h-5 w-5" />,
            getUrl: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
            color: "bg-[#1877F2]",
            hoverColor: "hover:bg-[#166FE5]",
        },
        {
            name: "X",
            icon: <TwitterIcon className="h-5 w-5" />,
            getUrl: (url, text) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
            color: "bg-black dark:bg-white dark:text-black",
            hoverColor: "hover:bg-gray-800 dark:hover:bg-gray-200",
        },
        {
            name: "Email",
            icon: <Mail className="h-5 w-5" />,
            getUrl: (url, text) => `mailto:?subject=${encodeURIComponent(`Join ${groupName} on Smart Split`)}&body=${encodeURIComponent(`${text}\n\n${url}`)}`,
            color: "bg-gray-600",
            hoverColor: "hover:bg-gray-700",
        },
    ];

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
                    text: shareText,
                    url: joinUrl,
                });
                setIsOpen(false);
            } catch {
                // User cancelled share
            }
        }
    };

    const handleSocialShare = (option: SocialShareOption) => {
        const shareUrl = option.getUrl(joinUrl, shareText);
        window.open(shareUrl, "_blank", "noopener,noreferrer,width=600,height=400");
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
                <>
                    {/* Mobile overlay backdrop */}
                    <div
                        className="fixed inset-0 z-40 bg-black/50 sm:hidden"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Modal - Bottom sheet on mobile, dropdown on desktop */}
                    <div className="fixed inset-x-0 bottom-0 z-50 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 rounded-t-2xl sm:rounded-xl border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800 max-h-[85vh] sm:max-h-none overflow-y-auto">
                        {/* Drag handle for mobile */}
                        <div className="mb-4 flex justify-center sm:hidden">
                            <div className="h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-600" />
                        </div>

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
                                    size={140}
                                    level="M"
                                    bgColor="#ffffff"
                                    fgColor="#0d9488"
                                />
                            </div>
                        </div>

                        {/* Invite Code */}
                        <div className="mb-4">
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
                                    title="Copy code"
                                >
                                    {copied === "code" ? (
                                        <Check className="h-4 w-4 text-green-500" />
                                    ) : (
                                        <Copy className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                        </div>

                        {/* Social Share Buttons */}
                        <div className="mb-4">
                            <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                                Share via
                            </p>
                            <div className="flex justify-between gap-2">
                                {socialShareOptions.map((option) => (
                                    <button
                                        key={option.name}
                                        onClick={() => handleSocialShare(option)}
                                        className={`flex h-10 w-10 items-center justify-center rounded-full text-white transition-all ${option.color} ${option.hoverColor} hover:scale-110`}
                                        title={`Share via ${option.name}`}
                                    >
                                        {option.icon}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Copy Link / Native Share */}
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
                                    More
                                </Button>
                            )}
                        </div>

                        {/* Help Text */}
                        <p className="mt-3 text-center text-[10px] text-gray-500 dark:text-gray-400">
                            Others can scan the QR or enter the code at{" "}
                            <span className="font-mono text-teal-600 dark:text-teal-400">/groups/join</span>
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}

