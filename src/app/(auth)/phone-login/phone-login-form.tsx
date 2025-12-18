"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Phone, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/ui/phone-input";
import { sendPhoneOTP, verifyPhoneOTP } from "../actions";

type Step = "phone" | "otp";

interface PhoneLoginFormProps {
    csrfToken: string;
}

export function PhoneLoginForm({ csrfToken }: PhoneLoginFormProps) {
    const [step, setStep] = useState<Step>("phone");
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [countdown, setCountdown] = useState(0);

    const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Countdown timer for resend
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    const handleSendOTP = async () => {
        if (!phone || phone.length < 10) {
            setError("Please enter a valid phone number");
            return;
        }

        setIsLoading(true);
        setError(null);

        const formData = new FormData();
        formData.append("phone", phone);
        formData.append("csrf_token", csrfToken); // Include CSRF token

        const result = await sendPhoneOTP(formData);

        if (result?.error) {
            setError(result.error);
            setIsLoading(false);
        } else {
            setStep("otp");
            setCountdown(60); // 60 second countdown
            setIsLoading(false);
            // Focus first OTP input
            setTimeout(() => otpRefs.current[0]?.focus(), 100);
        }
    };

    const handleVerifyOTP = async () => {
        const token = otp.join("");
        if (token.length !== 6) {
            setError("Please enter the complete 6-digit code");
            return;
        }

        setIsLoading(true);
        setError(null);

        const formData = new FormData();
        formData.append("phone", phone);
        formData.append("token", token);
        formData.append("csrf_token", csrfToken); // Include CSRF token

        const result = await verifyPhoneOTP(formData);

        if (result?.error) {
            setError(result.error);
            setIsLoading(false);
            // Clear OTP on error
            setOtp(["", "", "", "", "", ""]);
            otpRefs.current[0]?.focus();
        }
    };

    const handleOtpChange = (index: number, value: string) => {
        if (value.length > 1) {
            // Handle paste
            const digits = value.replace(/\D/g, "").slice(0, 6).split("");
            const newOtp = [...otp];
            digits.forEach((digit, i) => {
                if (index + i < 6) {
                    newOtp[index + i] = digit;
                }
            });
            setOtp(newOtp);
            // Focus last filled or next empty
            const nextIndex = Math.min(index + digits.length, 5);
            otpRefs.current[nextIndex]?.focus();
        } else {
            const newOtp = [...otp];
            newOtp[index] = value.replace(/\D/g, "");
            setOtp(newOtp);

            // Auto-focus next input
            if (value && index < 5) {
                otpRefs.current[index + 1]?.focus();
            }
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace" && !otp[index] && index > 0) {
            // Move to previous input on backspace if current is empty
            otpRefs.current[index - 1]?.focus();
        }
    };

    const handleResendOTP = async () => {
        if (countdown > 0) return;
        await handleSendOTP();
    };

    const formatPhone = (phone: string) => {
        // Show last 4 digits
        if (phone.length > 4) {
            return `****${phone.slice(-4)}`;
        }
        return phone;
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="text-center lg:text-left">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
                    {step === "phone" ? "Sign in with Phone" : "Enter verification code"}
                </h1>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                    {step === "phone"
                        ? "We'll send you a one-time verification code"
                        : `We sent a 6-digit code to ${formatPhone(phone)}`}
                </p>
            </div>

            {/* Error message */}
            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                    {error}
                </div>
            )}

            {step === "phone" ? (
                /* Phone Number Step */
                <div className="space-y-5">
                    <div className="relative">
                        <Phone className="absolute top-3.5 left-3 h-5 w-5 text-gray-400 pointer-events-none z-10" />
                        <div className="pl-10">
                            <PhoneInput
                                value={phone}
                                onChange={setPhone}
                            />
                        </div>
                    </div>

                    <Button
                        type="button"
                        className="w-full"
                        size="lg"
                        onClick={handleSendOTP}
                        isLoading={isLoading}
                    >
                        Continue
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            ) : (
                /* OTP Verification Step */
                <div className="space-y-6">
                    {/* OTP Input */}
                    <div className="flex justify-center gap-2 sm:gap-3">
                        {otp.map((digit, index) => (
                            <input
                                key={index}
                                ref={(el) => { otpRefs.current[index] = el; }}
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                value={digit}
                                onChange={(e) => handleOtpChange(index, e.target.value)}
                                onKeyDown={(e) => handleOtpKeyDown(index, e)}
                                className="h-12 w-10 sm:h-14 sm:w-12 rounded-lg border-2 border-gray-300 bg-white text-center text-xl font-semibold text-gray-900 transition-colors focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:border-teal-400"
                            />
                        ))}
                    </div>

                    <Button
                        type="button"
                        className="w-full"
                        size="lg"
                        onClick={handleVerifyOTP}
                        isLoading={isLoading}
                        disabled={otp.join("").length !== 6}
                    >
                        Verify & Sign In
                    </Button>

                    {/* Resend */}
                    <div className="text-center">
                        {countdown > 0 ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Resend code in <span className="font-medium">{countdown}s</span>
                            </p>
                        ) : (
                            <button
                                type="button"
                                onClick={handleResendOTP}
                                disabled={isLoading}
                                className="text-sm font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300"
                            >
                                Didn&apos;t receive the code? Resend
                            </button>
                        )}
                    </div>

                    {/* Change number */}
                    <button
                        type="button"
                        onClick={() => {
                            setStep("phone");
                            setOtp(["", "", "", "", "", ""]);
                            setError(null);
                        }}
                        className="flex w-full items-center justify-center gap-1 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Change phone number
                    </button>
                </div>
            )}

            {/* Divider */}
            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200 dark:border-gray-800" />
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="bg-white px-4 text-gray-500 dark:bg-gray-950 dark:text-gray-400">
                        Or sign in with
                    </span>
                </div>
            </div>

            {/* Other options */}
            <div className="flex flex-col gap-3">
                <Link href="/login">
                    <Button variant="outline" className="w-full h-12">
                        Email & Password
                    </Button>
                </Link>
            </div>

            {/* Sign up link */}
            <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                Don&apos;t have an account?{" "}
                <Link
                    href="/register"
                    className="font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300"
                >
                    Sign up for free
                </Link>
            </p>
        </div>
    );
}

