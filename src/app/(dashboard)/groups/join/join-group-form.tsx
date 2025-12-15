"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { QrCode, Users, ArrowRight, CheckCircle2, XCircle, ArrowLeft, Camera, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { QRScanner } from "@/components/ui/qr-scanner";
import { useToast } from "@/components/ui/toast";
import { groupsService } from "@/services/groups";

interface JoinGroupFormProps {
    initialCode: string;
    userId: string;
}

type JoinState = "idle" | "validating" | "preview" | "joining" | "success" | "error";
type InputMode = "manual" | "scan";

interface GroupPreview {
    id: string;
    name: string;
    description: string | null;
    member_count: number;
}

export function JoinGroupForm({ initialCode, userId }: JoinGroupFormProps) {
    const router = useRouter();
    const toast = useToast();
    const [code, setCode] = useState(initialCode);
    const [state, setState] = useState<JoinState>(initialCode ? "validating" : "idle");
    const [error, setError] = useState<string | null>(null);
    const [groupPreview, setGroupPreview] = useState<GroupPreview | null>(null);
    const [joinedGroupId, setJoinedGroupId] = useState<string | null>(null);
    const [inputMode, setInputMode] = useState<InputMode>("manual");

    // Auto-validate if code is provided in URL
    useEffect(() => {
        if (initialCode && state === "validating") {
            validateCode(initialCode);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialCode]);

    const validateCode = async (codeToValidate: string) => {
        if (!codeToValidate.trim()) {
            setError("Please enter an invite code");
            setState("error");
            return;
        }

        setState("validating");
        setError(null);

        try {
            // Fetch group preview
            const response = await fetch(`/api/groups/preview?code=${encodeURIComponent(codeToValidate)}`);
            const data = await response.json();

            if (!response.ok || !data.group) {
                setError(data.error || "Invalid invite code");
                setState("error");
                return;
            }

            if (data.alreadyMember) {
                setError("You are already a member of this group");
                setState("error");
                setGroupPreview(data.group);
                return;
            }

            setGroupPreview(data.group);
            setState("preview");
        } catch {
            setError("Failed to validate invite code");
            setState("error");
        }
    };

    const handleJoin = async () => {
        if (!groupPreview) return;

        setState("joining");
        setError(null);

        try {
            const result = await groupsService.joinGroupByInviteCode(code, userId);

            if (!result.success) {
                setError(result.error || "Failed to join group");
                toast.error(result.error || "Failed to join group");
                setState("error");
                return;
            }

            setJoinedGroupId(result.groupId || null);
            setState("success");
            toast.success(`Welcome to ${groupPreview.name}!`);

            // Redirect after a short delay
            setTimeout(() => {
                router.push(`/groups/${result.groupId}`);
            }, 2000);
        } catch {
            setError("Failed to join group");
            toast.error("Failed to join group");
            setState("error");
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        validateCode(code);
    };

    const handleScan = (scannedCode: string) => {
        setCode(scannedCode);
        setInputMode("manual"); // Switch back to show the code
        validateCode(scannedCode);
    };

    const resetForm = () => {
        setCode("");
        setState("idle");
        setError(null);
        setGroupPreview(null);
    };

    // Success state
    if (state === "success") {
        return (
            <Card className="w-full max-w-md">
                <CardContent className="flex flex-col items-center py-12">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                        <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                    </div>
                    <h2 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">
                        Welcome to {groupPreview?.name}!
                    </h2>
                    <p className="mt-2 text-center text-gray-500 dark:text-gray-400">
                        You&apos;ve successfully joined the group
                    </p>
                    <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                        <Spinner size="sm" />
                        Redirecting to group...
                    </div>
                    <Link href={`/groups/${joinedGroupId}`} className="mt-4">
                        <Button variant="outline" size="sm">
                            Go to group now
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </Link>
                </CardContent>
            </Card>
        );
    }

    // Preview state - show group info and join button
    if ((state === "preview" || state === "joining") && groupPreview) {
        const isJoining = state === "joining";
        return (
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-50 to-teal-100 text-3xl dark:from-teal-900/30 dark:to-teal-800/30">
                        <Users className="h-8 w-8 text-teal-600 dark:text-teal-400" />
                    </div>
                    <CardTitle className="mt-4">{groupPreview.name}</CardTitle>
                    {groupPreview.description && (
                        <CardDescription>{groupPreview.description}</CardDescription>
                    )}
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800/50">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Members</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                                {groupPreview.member_count} {groupPreview.member_count === 1 ? "member" : "members"}
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            onClick={resetForm}
                            className="flex-1"
                            disabled={isJoining}
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back
                        </Button>
                        <Button
                            onClick={handleJoin}
                            disabled={isJoining}
                            className="flex-1"
                        >
                            {isJoining ? (
                                <>
                                    <Spinner size="sm" variant="white" className="mr-2" />
                                    Joining...
                                </>
                            ) : (
                                <>
                                    Join Group
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Default form state with tabs
    return (
        <Card className="w-full max-w-md mx-auto">
            <CardHeader className="text-center px-4 sm:px-6">
                <div className="mx-auto flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-900/30 dark:to-teal-800/30">
                    <QrCode className="h-7 w-7 sm:h-8 sm:w-8 text-teal-600 dark:text-teal-400" />
                </div>
                <CardTitle className="mt-3 sm:mt-4 text-lg sm:text-xl">Join a Group</CardTitle>
                <CardDescription className="text-sm">
                    Scan a QR code or enter the invite code
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-4 sm:px-6">
                {/* Tab Buttons */}
                <div className="flex rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
                    <button
                        type="button"
                        onClick={() => setInputMode("scan")}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                            inputMode === "scan"
                                ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                        }`}
                    >
                        <Camera className="h-4 w-4" />
                        Scan QR
                    </button>
                    <button
                        type="button"
                        onClick={() => setInputMode("manual")}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                            inputMode === "manual"
                                ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                        }`}
                    >
                        <Keyboard className="h-4 w-4" />
                        Enter Code
                    </button>
                </div>

                {/* QR Scanner */}
                {inputMode === "scan" && (
                    <QRScanner
                        onScan={handleScan}
                        onError={(err) => setError(err)}
                    />
                )}

                {/* Manual Code Entry */}
                {inputMode === "manual" && (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label htmlFor="code" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Invite Code
                            </label>
                            <Input
                                id="code"
                                value={code}
                                onChange={(e) => {
                                    setCode(e.target.value.toUpperCase());
                                    if (error) {
                                        setError(null);
                                        setState("idle");
                                    }
                                }}
                                placeholder="Enter 8-character code"
                                className="text-center font-mono text-lg tracking-widest"
                                maxLength={8}
                                autoFocus
                            />
                        </div>

                        <Button
                            type="submit"
                            className="w-full"
                            disabled={state === "validating" || !code.trim()}
                        >
                            {state === "validating" ? (
                                <>
                                    <Spinner size="sm" variant="white" className="mr-2" />
                                    Validating...
                                </>
                            ) : (
                                <>
                                    Continue
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </>
                            )}
                        </Button>
                    </form>
                )}

                {/* Error Display */}
                {(state === "error" || error) && (
                    <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
                        <XCircle className="h-5 w-5 shrink-0 text-red-500" />
                        <div className="text-sm">
                            <p className="font-medium text-red-800 dark:text-red-300">{error}</p>
                            {groupPreview && (
                                <Link
                                    href={`/groups/${groupPreview.id}`}
                                    className="mt-1 inline-block text-red-600 underline hover:no-underline dark:text-red-400"
                                >
                                    Go to {groupPreview.name} →
                                </Link>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
