"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { forgotPassword } from "../actions";
import { useRecaptcha } from "@/hooks/use-recaptcha";
import { useCsrf } from "@/hooks/use-csrf";

const forgotPasswordSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

interface ForgotPasswordFormProps {
    csrfToken: string;
}

export function ForgotPasswordForm({ csrfToken }: ForgotPasswordFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);
    const { executeRecaptcha, isEnabled: recaptchaEnabled } = useRecaptcha();
    const { refreshToken } = useCsrf(csrfToken);

    const {
        register,
        handleSubmit,
        formState: { errors },
        getValues,
    } = useForm<ForgotPasswordFormData>({
        resolver: zodResolver(forgotPasswordSchema),
    });

    const onSubmit = async (data: ForgotPasswordFormData) => {
        setIsLoading(true);
        setError(null);

        // Get fresh CSRF token to prevent expiration issues
        const freshCsrfToken = await refreshToken();

        // Execute reCAPTCHA if enabled
        let recaptchaToken: string | null = null;
        if (recaptchaEnabled) {
            recaptchaToken = await executeRecaptcha("forgot_password");
        }

        const formData = new FormData();
        formData.append("email", data.email);
        formData.append("csrf_token", freshCsrfToken);
        if (recaptchaToken) {
            formData.append("recaptcha_token", recaptchaToken);
        }

        const result = await forgotPassword(formData);

        if (result?.error) {
            setError(result.error);
            setIsLoading(false);
        } else {
            setIsSuccess(true);
            setIsLoading(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="space-y-8">
                <div className="flex flex-col items-center text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                        <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                    </div>
                    <h1 className="mt-6 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
                        Check your email
                    </h1>
                    <p className="mt-3 text-gray-600 dark:text-gray-400 max-w-sm">
                        If an account exists with{" "}
                        <span className="font-medium text-gray-900 dark:text-white">
                            {getValues("email")}
                        </span>
                        , you&apos;ll receive a password reset link.
                    </p>
                </div>

                <div className="space-y-4">
                    <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                        Didn&apos;t receive the email? Check your spam folder or
                    </p>
                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                            setIsSuccess(false);
                            setError(null);
                        }}
                    >
                        Try another email address
                    </Button>
                </div>

                <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                    <Link
                        href="/login"
                        className="inline-flex items-center gap-1 font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to sign in
                    </Link>
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="text-center lg:text-left">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
                    Forgot your password?
                </h1>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                    No worries, we&apos;ll send you reset instructions.
                </p>
            </div>

            {/* Error message */}
            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                    {error}
                </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="relative">
                    <Mail className="absolute top-3.5 left-3 h-5 w-5 text-gray-400" />
                    <Input
                        type="email"
                        placeholder="Enter your email"
                        className="pl-10"
                        {...register("email")}
                        error={errors.email?.message}
                    />
                </div>

                <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    isLoading={isLoading}
                >
                    Reset Password
                </Button>
            </form>

            {/* Back to login */}
            <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                <Link
                    href="/login"
                    className="inline-flex items-center gap-1 font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to sign in
                </Link>
            </p>
        </div>
    );
}

