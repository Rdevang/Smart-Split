"use client";

import { useState, useRef } from "react";
import { Sparkles, Mic, MicOff, Camera, Loader2, X, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { ParsedExpense, ReceiptData } from "@/lib/openai";

interface AIExpenseInputProps {
    groupId: string;
    onExpenseParsed: (expense: ParsedExpense) => void;
    onReceiptScanned?: (receipt: ReceiptData) => void;
    disabled?: boolean;
}

export function AIExpenseInput({
    groupId,
    onExpenseParsed,
    onReceiptScanned,
    disabled,
}: AIExpenseInputProps) {
    const { toast } = useToast();
    const [text, setText] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

    // Voice input using Web Speech API
    const toggleVoiceInput = () => {
        if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
            toast({
                title: "Not supported",
                message: "Voice input is not supported in your browser",
                variant: "error",
            });
            return;
        }

        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
            return;
        }

        const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognitionClass) return;
        const recognition = new SpeechRecognitionClass();
        recognitionRef.current = recognition;

        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = "en-IN"; // Support Indian English

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);

        recognition.onresult = (event) => {
            const transcript = Array.from(event.results)
                .map((result) => result[0].transcript)
                .join("");
            setText(transcript);
        };

        recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error);
            setIsListening(false);
            toast({
                title: "Voice error",
                message: "Could not recognize speech. Please try again.",
                variant: "error",
            });
        };

        recognition.start();
    };

    // Parse text with AI
    const handleParseText = async () => {
        if (!text.trim()) {
            toast({
                title: "Enter something",
                message: "Please describe the expense",
                variant: "error",
            });
            return;
        }

        setIsProcessing(true);
        try {
            const response = await fetch("/api/ai/parse-expense", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text, groupId }),
            });

            if (!response.ok) {
                throw new Error("Failed to parse expense");
            }

            const data = await response.json();
            onExpenseParsed(data.expense);
            setText("");

            toast({
                title: "Expense parsed!",
                message: `${data.expense.description} - ₹${data.expense.amount}`,
                variant: "success",
            });
        } catch (error) {
            console.error("Parse error:", error);
            toast({
                title: "Error",
                message: "Failed to parse expense. Please try again.",
                variant: "error",
            });
        } finally {
            setIsProcessing(false);
        }
    };

    // Scan receipt image
    const handleReceiptUpload = async (file: File) => {
        if (!onReceiptScanned) return;

        setIsProcessing(true);
        try {
            const formData = new FormData();
            formData.append("receipt", file);

            const response = await fetch("/api/ai/scan-receipt", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Failed to scan receipt");
            }

            const data = await response.json();
            onReceiptScanned(data.receipt);

            toast({
                title: "Receipt scanned!",
                message: `${data.receipt.merchant} - Total: ₹${data.receipt.total}`,
                variant: "success",
            });
        } catch (error) {
            console.error("Scan error:", error);
            toast({
                title: "Error",
                message: "Failed to scan receipt. Please try again.",
                variant: "error",
            });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="space-y-3">
            {/* AI Badge */}
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-purple-500/10 to-pink-500/10 px-3 py-1">
                    <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                    <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                        AI-Powered
                    </span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                    Describe your expense naturally
                </span>
            </div>

            {/* Input Area */}
            <div className="relative">
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder='Try: "Paid ₹500 for dinner with Mom, split equally" or "Uber to airport $45"'
                    disabled={disabled || isProcessing}
                    className={cn(
                        "w-full rounded-xl border border-gray-200 bg-white p-4 pr-24 text-sm placeholder:text-gray-400",
                        "focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500/20",
                        "dark:border-gray-700 dark:bg-gray-900 dark:placeholder:text-gray-500",
                        "min-h-[80px] resize-none transition-all",
                        isListening && "border-purple-500 ring-2 ring-purple-500/20"
                    )}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleParseText();
                        }
                    }}
                />

                {/* Action Buttons */}
                <div className="absolute bottom-3 right-3 flex items-center gap-2">
                    {/* Voice Input */}
                    <button
                        type="button"
                        onClick={toggleVoiceInput}
                        disabled={disabled || isProcessing}
                        className={cn(
                            "rounded-lg p-2 transition-colors",
                            isListening
                                ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                                : "text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                        )}
                        title={isListening ? "Stop listening" : "Voice input"}
                    >
                        {isListening ? (
                            <MicOff className="h-4 w-4 animate-pulse" />
                        ) : (
                            <Mic className="h-4 w-4" />
                        )}
                    </button>

                    {/* Receipt Scanner */}
                    {onReceiptScanned && (
                        <>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleReceiptUpload(file);
                                    e.target.value = "";
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={disabled || isProcessing}
                                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                                title="Scan receipt"
                            >
                                <Camera className="h-4 w-4" />
                            </button>
                        </>
                    )}
                </div>

                {/* Clear Button */}
                {text && (
                    <button
                        type="button"
                        onClick={() => setText("")}
                        className="absolute right-3 top-3 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>

            {/* Parse Button */}
            <Button
                type="button"
                onClick={handleParseText}
                disabled={disabled || isProcessing || !text.trim()}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
                {isProcessing ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                    </>
                ) : (
                    <>
                        <Wand2 className="mr-2 h-4 w-4" />
                        Parse with AI
                    </>
                )}
            </Button>

            {/* Examples */}
            <div className="flex flex-wrap gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">Try:</span>
                {[
                    "Dinner ₹800 split with Mom",
                    "Uber ₹200",
                    "Movie tickets for 4, ₹1200",
                ].map((example) => (
                    <button
                        key={example}
                        type="button"
                        onClick={() => setText(example)}
                        className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                    >
                        {example}
                    </button>
                ))}
            </div>
        </div>
    );
}

// Type declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
    length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
    isFinal: boolean;
    length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
    error: string;
    message?: string;
}

interface SpeechRecognitionInstance extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
    onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
    onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => void) | null;
    onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEvent) => void) | null;
    start(): void;
    stop(): void;
    abort(): void;
}

interface SpeechRecognitionConstructor {
    new(): SpeechRecognitionInstance;
}

declare global {
    interface Window {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
    }
}

