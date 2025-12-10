"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { login, signInWithGoogle, signInWithGithub } from "../actions";

const loginSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

// Map Supabase error codes to user-friendly messages
const errorMessages: Record<string, string> = {
    otp_expired:
        "Email confirmation link has expired. Please register again or request a new link.",
    access_denied: "Access was denied. Please try again.",
    invalid_request: "Invalid request. Please try again.",
    auth_callback_error: "Authentication failed. Please try again.",
};

function LoginForm() {
    const searchParams = useSearchParams();
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [isGithubLoading, setIsGithubLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Get URL error from search params
    const urlError = useMemo(() => {
        const errorCode =
            searchParams.get("error_code") || searchParams.get("error");
        const errorDescription = searchParams.get("error_description");

        if (errorCode) {
            return (
                errorMessages[errorCode] ||
                errorDescription?.replace(/\+/g, " ") ||
                "An error occurred. Please try again."
            );
        }
        return null;
    }, [searchParams]);

    // Display either URL error or form error
    const displayError = error || urlError;

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
    });

    const onSubmit = async (data: LoginFormData) => {
        setIsLoading(true);
        setError(null);

        const formData = new FormData();
        formData.append("email", data.email);
        formData.append("password", data.password);

        const result = await login(formData);

        if (result?.error) {
            setError(result.error);
            setIsLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setIsGoogleLoading(true);
        setError(null);
        const result = await signInWithGoogle();
        if (result?.error) {
            setError(result.error);
            setIsGoogleLoading(false);
        }
    };

    const handleGithubSignIn = async () => {
        setIsGithubLoading(true);
        setError(null);
        const result = await signInWithGithub();
        if (result?.error) {
            setError(result.error);
            setIsGithubLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="text-center lg:text-left">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
                    Welcome back
                </h1>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                    Sign in to your account to continue
                </p>
            </div>

            {/* Error message */}
            {displayError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                    {displayError}
                </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="relative">
                    <Mail className="absolute top-3.5 left-3 h-5 w-5 text-gray-400" />
                    <Input
                        type="email"
                        placeholder="Email address"
                        className="pl-10"
                        {...register("email")}
                        error={errors.email?.message}
                    />
                </div>

                <div className="relative">
                    <Lock className="absolute top-3.5 left-3 h-5 w-5 text-gray-400" />
                    <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Password"
                        className="pl-10 pr-10"
                        {...register("password")}
                        error={errors.password?.message}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute top-3.5 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                        {showPassword ? (
                            <EyeOff className="h-5 w-5" />
                        ) : (
                            <Eye className="h-5 w-5" />
                        )}
                    </button>
                </div>

                <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                            Remember me
                        </span>
                    </label>
                    <Link
                        href="/forgot-password"
                        className="text-sm font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300"
                    >
                        Forgot password?
                    </Link>
                </div>

                <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    isLoading={isLoading}
                >
                    Sign In
                </Button>
            </form>

            {/* Divider */}
            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200 dark:border-gray-800" />
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="bg-white px-4 text-gray-500 dark:bg-gray-950 dark:text-gray-400">
                        Or continue with
                    </span>
                </div>
            </div>

            {/* Social login */}
            <div className="grid grid-cols-2 gap-4">
                <Button
                    variant="outline"
                    type="button"
                    className="h-12"
                    onClick={handleGoogleSignIn}
                    isLoading={isGoogleLoading}
                    disabled={isGoogleLoading || isGithubLoading}
                >
                    {!isGoogleLoading && (
                        <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                            <path
                                fill="currentColor"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                                fill="currentColor"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                                fill="currentColor"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            />
                            <path
                                fill="currentColor"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                        </svg>
                    )}
                    Google
                </Button>
                <Button
                    variant="outline"
                    type="button"
                    className="h-12"
                    onClick={handleGithubSignIn}
                    isLoading={isGithubLoading}
                    disabled={isGoogleLoading || isGithubLoading}
                >
                    {!isGithubLoading && (
                        <svg className="mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                        </svg>
                    )}
                    GitHub
                </Button>
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

export default function LoginPage() {
    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
                </div>
            }
        >
            <LoginForm />
        </Suspense>
    );
}
