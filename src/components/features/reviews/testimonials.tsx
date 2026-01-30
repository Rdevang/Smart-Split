"use client";

import { useEffect, useState } from "react";
import { Star, Quote } from "lucide-react";
import { log } from "@/lib/console-logger";

interface Review {
    id: string;
    author_name: string;
    author_title: string | null;
    author_avatar_url: string | null;
    content: string;
    rating: number;
    created_at: string;
}

// Fallback reviews if API fails
const fallbackReviews: Review[] = [
    {
        id: "1",
        author_name: "Sarah Chen",
        author_title: "Travel Enthusiast",
        author_avatar_url: null,
        content: "SmartSplit made our group trip so much easier. No more awkward conversations about money or spreadsheets. Everyone knows exactly what they owe.",
        rating: 5,
        created_at: new Date().toISOString(),
    },
    {
        id: "2",
        author_name: "Marcus Rodriguez",
        author_title: "Roommate",
        author_avatar_url: null,
        content: "Living with 3 roommates used to be a nightmare for bills. Now we just add expenses and settle up at the end of the month. Simple and fair!",
        rating: 5,
        created_at: new Date().toISOString(),
    },
    {
        id: "3",
        author_name: "Priya Sharma",
        author_title: "Team Lead",
        author_avatar_url: null,
        content: "Perfect for splitting team lunch orders and office supplies. The analytics feature helps us track spending patterns too. Highly recommend!",
        rating: 5,
        created_at: new Date().toISOString(),
    },
    {
        id: "4",
        author_name: "Alex Thompson",
        author_title: "College Student",
        author_avatar_url: null,
        content: "Finally an app that actually works for splitting bills. The QR code feature is genius - my friends joined our apartment group in seconds.",
        rating: 5,
        created_at: new Date().toISOString(),
    },
];

export function Testimonials() {
    const [reviews, setReviews] = useState<Review[]>(fallbackReviews);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchReviews() {
            try {
                const response = await fetch("/api/reviews");
                if (response.ok) {
                    const data = await response.json();
                    if (data.reviews && data.reviews.length > 0) {
                        // If we have fewer than 4 reviews from API, fill with fallbacks
                        if (data.reviews.length >= 4) {
                            setReviews(data.reviews);
                        } else {
                            // Merge API reviews with fallbacks to always show 4
                            const neededFallbacks = 4 - data.reviews.length;
                            const apiReviewNames = new Set(data.reviews.map((r: Review) => r.author_name));
                            const uniqueFallbacks = fallbackReviews.filter(f => !apiReviewNames.has(f.author_name));
                            setReviews([...data.reviews, ...uniqueFallbacks.slice(0, neededFallbacks)]);
                        }
                    }
                }
            } catch (error) {
                log.error("Reviews", "Failed to fetch reviews", error);
                // Keep fallback reviews
            } finally {
                setIsLoading(false);
            }
        }

        fetchReviews();
    }, []);

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    const getAvatarColor = (name: string) => {
        const colors = [
            "from-teal-500 to-cyan-500",
            "from-purple-500 to-pink-500",
            "from-orange-500 to-red-500",
            "from-blue-500 to-indigo-500",
            "from-green-500 to-emerald-500",
        ];
        const index = name.charCodeAt(0) % colors.length;
        return colors[index];
    };

    return (
        <section className="py-20 sm:py-32 bg-gray-50 dark:bg-gray-900/50">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-2xl text-center mb-16">
                    <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
                        Loved by thousands
                    </h2>
                    <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
                        See what our users have to say about SmartSplit
                    </p>
                </div>

                <div className={`grid gap-6 md:grid-cols-2 lg:grid-cols-4 ${isLoading ? "animate-pulse" : ""}`}>
                    {reviews.slice(0, 4).map((review, index) => (
                        <div
                            key={review.id}
                            className="group relative rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900"
                            style={{ animationDelay: `${index * 100}ms` }}
                        >
                            {/* Quote icon */}
                            <Quote className="absolute top-4 right-4 h-8 w-8 text-gray-100 dark:text-gray-800" />

                            {/* Stars */}
                            <div className="flex gap-1 mb-4">
                                {[...Array(5)].map((_, i) => (
                                    <Star
                                        key={i}
                                        className={`h-4 w-4 ${i < review.rating
                                            ? "fill-amber-400 text-amber-400"
                                            : "fill-gray-200 text-gray-200 dark:fill-gray-700 dark:text-gray-700"
                                            }`}
                                    />
                                ))}
                            </div>

                            {/* Content */}
                            <p className="text-gray-600 dark:text-gray-400 mb-6 line-clamp-4 leading-relaxed">
                                &ldquo;{review.content}&rdquo;
                            </p>

                            {/* Author */}
                            <div className="flex items-center gap-3 mt-auto">
                                {review.author_avatar_url ? (
                                    <img
                                        src={review.author_avatar_url}
                                        alt={review.author_name}
                                        className="h-10 w-10 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarColor(review.author_name)} text-sm font-semibold text-white`}>
                                        {getInitials(review.author_name)}
                                    </div>
                                )}
                                <div>
                                    <p className="font-semibold text-gray-900 dark:text-white">
                                        {review.author_name}
                                    </p>
                                    {review.author_title && (
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            {review.author_title}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

