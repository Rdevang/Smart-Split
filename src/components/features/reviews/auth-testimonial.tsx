"use client";

import { useEffect, useState } from "react";

interface Testimonial {
    quote: string;
    author: string;
    title: string;
}

const testimonials: Testimonial[] = [
    {
        quote: "SmartSplit made our group trip so much easier. No more awkward conversations about money or spreadsheets. Everyone knows exactly what they owe.",
        author: "Sarah Chen",
        title: "Travel Enthusiast",
    },
    {
        quote: "Living with 3 roommates used to be a nightmare for bills. Now we just add expenses and settle up at the end of the month. Simple and fair!",
        author: "Marcus Rodriguez",
        title: "Roommate",
    },
    {
        quote: "Perfect for splitting team lunch orders and office supplies. The analytics feature helps us track spending patterns too. Highly recommend!",
        author: "Priya Sharma",
        title: "Team Lead",
    },
    {
        quote: "Finally an app that actually works for splitting bills. The QR code feature is genius - my friends joined our apartment group in seconds.",
        author: "Alex Thompson",
        title: "College Student",
    },
];

export function AuthTestimonial() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            setIsAnimating(true);
            setTimeout(() => {
                setCurrentIndex((prev) => (prev + 1) % testimonials.length);
                setIsAnimating(false);
            }, 300);
        }, 5000); // Change every 5 seconds

        return () => clearInterval(interval);
    }, []);

    const current = testimonials[currentIndex];

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase();
    };

    return (
        <div className="max-w-md">
            <blockquote 
                className={`text-xl leading-relaxed text-white/90 transition-opacity duration-300 ${
                    isAnimating ? "opacity-0" : "opacity-100"
                }`}
            >
                &ldquo;{current.quote}&rdquo;
            </blockquote>
            <div 
                className={`mt-6 flex items-center gap-4 transition-opacity duration-300 ${
                    isAnimating ? "opacity-0" : "opacity-100"
                }`}
            >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-sm font-semibold text-white">
                    {getInitials(current.author)}
                </div>
                <div>
                    <div className="font-semibold text-white">{current.author}</div>
                    <div className="text-sm text-white/70">{current.title}</div>
                </div>
            </div>
            
            {/* Dots indicator */}
            <div className="mt-8 flex gap-2">
                {testimonials.map((_, index) => (
                    <button
                        key={index}
                        onClick={() => {
                            setIsAnimating(true);
                            setTimeout(() => {
                                setCurrentIndex(index);
                                setIsAnimating(false);
                            }, 300);
                        }}
                        className={`h-2 rounded-full transition-all duration-300 ${
                            index === currentIndex 
                                ? "w-8 bg-white" 
                                : "w-2 bg-white/30 hover:bg-white/50"
                        }`}
                        aria-label={`Show testimonial ${index + 1}`}
                    />
                ))}
            </div>
        </div>
    );
}

