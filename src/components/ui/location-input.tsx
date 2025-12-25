"use client";

import { useState, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LocationData {
    name: string;
    coordinates?: {
        lat: number;
        lng: number;
    };
}

interface LocationInputProps {
    label?: string;
    value?: LocationData;
    onChange: (location: LocationData | undefined) => void;
    placeholder?: string;
    error?: string;
    className?: string;
}

export function LocationInput({
    label = "Location",
    value,
    onChange,
    placeholder = "Enter location or use current",
    error,
    className,
}: LocationInputProps) {
    const [isLoadingLocation, setIsLoadingLocation] = useState(false);
    const [locationError, setLocationError] = useState<string | null>(null);

    // Auto-dismiss location error after 5 seconds (it's just a warning)
    useEffect(() => {
        if (locationError) {
            const timer = setTimeout(() => setLocationError(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [locationError]);

    // Handle manual text input
    const handleTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const name = e.target.value;
        if (name) {
            onChange({
                name,
                coordinates: value?.coordinates, // Keep existing coordinates if any
            });
        } else {
            onChange(undefined);
        }
        setLocationError(null);
    }, [onChange, value?.coordinates]);

    // Get current location using Geolocation API
    const getCurrentLocation = useCallback(async () => {
        if (!navigator.geolocation) {
            setLocationError("Geolocation is not supported by your browser");
            return;
        }

        setIsLoadingLocation(true);
        setLocationError(null);

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;

                // Try to get address from coordinates using reverse geocoding
                let locationName = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

                try {
                    // Use free Nominatim API for reverse geocoding
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
                        {
                            headers: {
                                "User-Agent": "SmartSplit/1.0",
                            },
                        }
                    );

                    if (response.ok) {
                        const data = await response.json();
                        if (data.display_name) {
                            // Shorten the address (take first 2-3 parts)
                            const parts = data.display_name.split(", ");
                            locationName = parts.slice(0, 3).join(", ");
                        }
                    }
                } catch {
                    // If geocoding fails, use coordinates as fallback
                    console.warn("Reverse geocoding failed, using coordinates");
                }

                onChange({
                    name: locationName,
                    coordinates: {
                        lat: latitude,
                        lng: longitude,
                    },
                });

                setIsLoadingLocation(false);
            },
            (error) => {
                setIsLoadingLocation(false);

                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        setLocationError("Location permission denied. Please enable location access.");
                        break;
                    case error.POSITION_UNAVAILABLE:
                        setLocationError("Location information unavailable.");
                        break;
                    case error.TIMEOUT:
                        setLocationError("Location request timed out.");
                        break;
                    default:
                        setLocationError("Unable to get your location.");
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000, // Cache for 1 minute
            }
        );
    }, [onChange]);

    // Clear location
    const clearLocation = useCallback(() => {
        onChange(undefined);
        setLocationError(null);
    }, [onChange]);

    return (
        <div className={cn("space-y-2", className)}>
            {label && (
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    {label}
                </label>
            )}

            <div className="flex gap-2">
                <div className="relative flex-1">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <MapPin className="h-4 w-4" />
                    </div>
                    <Input
                        value={value?.name || ""}
                        onChange={handleTextChange}
                        placeholder={placeholder}
                        className="pl-9 pr-8"
                    />
                    {value?.name && (
                        <button
                            type="button"
                            onClick={clearLocation}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={getCurrentLocation}
                    disabled={isLoadingLocation}
                    title="Use current location"
                >
                    {isLoadingLocation ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Navigation className="h-4 w-4" />
                    )}
                </Button>
            </div>

            {/* Show coordinates if available */}
            {value?.coordinates && (
                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    GPS: {value.coordinates.lat.toFixed(4)}, {value.coordinates.lng.toFixed(4)}
                </p>
            )}

            {/* Error messages */}
            {error && (
                <p className="text-sm text-red-600 dark:text-red-400">
                    {error}
                </p>
            )}
            {/* Location error is a warning, not blocking - manual input still works */}
            {locationError && !error && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                    {locationError} You can still enter location manually.
                </p>
            )}
        </div>
    );
}

