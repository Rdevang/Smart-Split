"use client";

import { forwardRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Common country codes
const COUNTRIES = [
    { code: "+1", country: "US", flag: "🇺🇸" },
    { code: "+1", country: "CA", flag: "🇨🇦" },
    { code: "+44", country: "UK", flag: "🇬🇧" },
    { code: "+91", country: "IN", flag: "🇮🇳" },
    { code: "+61", country: "AU", flag: "🇦🇺" },
    { code: "+49", country: "DE", flag: "🇩🇪" },
    { code: "+33", country: "FR", flag: "🇫🇷" },
    { code: "+81", country: "JP", flag: "🇯🇵" },
    { code: "+86", country: "CN", flag: "🇨🇳" },
    { code: "+55", country: "BR", flag: "🇧🇷" },
    { code: "+52", country: "MX", flag: "🇲🇽" },
    { code: "+34", country: "ES", flag: "🇪🇸" },
    { code: "+39", country: "IT", flag: "🇮🇹" },
    { code: "+7", country: "RU", flag: "🇷🇺" },
    { code: "+82", country: "KR", flag: "🇰🇷" },
];

export interface PhoneInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
    value?: string;
    onChange?: (value: string) => void;
    error?: string;
}

const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
    ({ className, value = "", onChange, error, ...props }, ref) => {
        const [isOpen, setIsOpen] = useState(false);
        const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[3]); // Default to India
        const [phoneNumber, setPhoneNumber] = useState("");

        const handleCountrySelect = (country: typeof COUNTRIES[0]) => {
            setSelectedCountry(country);
            setIsOpen(false);
            // Update the full phone number
            if (phoneNumber) {
                onChange?.(`${country.code}${phoneNumber}`);
            }
        };

        const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const number = e.target.value.replace(/\D/g, ""); // Only digits
            setPhoneNumber(number);
            onChange?.(`${selectedCountry.code}${number}`);
        };

        return (
            <div className="space-y-1">
                <div className="flex">
                    {/* Country Code Dropdown */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setIsOpen(!isOpen)}
                            className={cn(
                                "flex h-12 items-center gap-1 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 px-3 text-sm transition-colors",
                                "hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-0",
                                "dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700",
                                error && "border-red-500 dark:border-red-500"
                            )}
                        >
                            <span className="text-lg">{selectedCountry.flag}</span>
                            <span className="text-gray-700 dark:text-gray-300">{selectedCountry.code}</span>
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                        </button>

                        {/* Dropdown */}
                        {isOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setIsOpen(false)}
                                />
                                <div className="absolute left-0 top-full z-20 mt-1 max-h-60 w-48 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                                    {COUNTRIES.map((country, index) => (
                                        <button
                                            key={`${country.code}-${country.country}-${index}`}
                                            type="button"
                                            onClick={() => handleCountrySelect(country)}
                                            className={cn(
                                                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                                                "hover:bg-gray-100 dark:hover:bg-gray-700",
                                                selectedCountry.country === country.country && "bg-teal-50 dark:bg-teal-900/20"
                                            )}
                                        >
                                            <span className="text-lg">{country.flag}</span>
                                            <span className="text-gray-700 dark:text-gray-300">{country.country}</span>
                                            <span className="ml-auto text-gray-500">{country.code}</span>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Phone Number Input */}
                    <input
                        ref={ref}
                        type="tel"
                        inputMode="numeric"
                        value={phoneNumber}
                        onChange={handlePhoneChange}
                        className={cn(
                            "flex h-12 w-full rounded-r-lg border border-gray-300 bg-white px-4 text-sm transition-colors",
                            "placeholder:text-gray-400",
                            "focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20",
                            "dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500",
                            "dark:focus:border-teal-400 dark:focus:ring-teal-400/20",
                            error && "border-red-500 focus:border-red-500 focus:ring-red-500/20 dark:border-red-500",
                            className
                        )}
                        placeholder="Phone number"
                        {...props}
                    />
                </div>

                {error && (
                    <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
                )}
            </div>
        );
    }
);

PhoneInput.displayName = "PhoneInput";

export { PhoneInput };

