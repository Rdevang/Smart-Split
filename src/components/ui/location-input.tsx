"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, Loader2, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LocationData {
    name: string;
    coordinates?: {
        lat: number;
        lng: number;
    };
}

interface PhotonFeature {
    geometry: {
        coordinates: [number, number]; // [lng, lat]
    };
    properties: {
        name?: string;
        street?: string;
        housenumber?: string;
        city?: string;
        state?: string;
        country?: string;
        postcode?: string;
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

// Format address from Photon properties
function formatAddress(props: PhotonFeature["properties"]): string {
    const parts: string[] = [];

    if (props.name) parts.push(props.name);
    if (props.street) {
        const street = props.housenumber ? `${props.housenumber} ${props.street}` : props.street;
        if (!parts.includes(street)) parts.push(street);
    }
    if (props.city && !parts.includes(props.city)) parts.push(props.city);
    if (props.state && !parts.includes(props.state)) parts.push(props.state);

    return parts.slice(0, 3).join(", ") || "Unknown location";
}

export function LocationInput({
    label = "Location",
    value,
    onChange,
    placeholder = "Search location...",
    error,
    className,
}: LocationInputProps) {
    const [isLoadingLocation, setIsLoadingLocation] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [results, setResults] = useState<PhotonFeature[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [inputValue, setInputValue] = useState(value?.name || "");
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Sync input value with external value
    useEffect(() => {
        setInputValue(value?.name || "");
    }, [value?.name]);

    // Auto-dismiss location error after 5 seconds
    useEffect(() => {
        if (locationError) {
            const timer = setTimeout(() => setLocationError(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [locationError]);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Get user's location silently on mount
    useEffect(() => {
        if (navigator.geolocation && !userLocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    });
                },
                () => { /* Silently fail */ },
                { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
            );
        }
    }, [userLocation]);

    // Search using Photon API (free, OpenStreetMap-based)
    const searchLocations = useCallback(async (query: string) => {
        if (query.length < 2) {
            setResults([]);
            setShowDropdown(false);
            return;
        }

        setIsSearching(true);

        try {
            // Build URL with location bias if available
            let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`;

            // Bias results to user's location if available
            if (userLocation) {
                url += `&lat=${userLocation.lat}&lon=${userLocation.lng}`;
            }

            const response = await fetch(url);

            if (response.ok) {
                const data = await response.json();
                if (data.features && data.features.length > 0) {
                    setResults(data.features);
                    setShowDropdown(true);
                } else {
                    setResults([]);
                    setShowDropdown(false);
                }
            }
        } catch (err) {
            console.warn("Location search failed:", err);
            setResults([]);
        } finally {
            setIsSearching(false);
        }
    }, [userLocation]);

    // Handle text input with debounced search
    const handleTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const text = e.target.value;
        setInputValue(text);
        setLocationError(null);

        // Update value without coordinates when typing
        if (text) {
            onChange({ name: text, coordinates: undefined });
        } else {
            onChange(undefined);
        }

        // Debounce search
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        searchTimeoutRef.current = setTimeout(() => {
            searchLocations(text);
        }, 300);
    }, [onChange, searchLocations]);

    // Select a result
    const selectResult = useCallback((feature: PhotonFeature) => {
        const address = formatAddress(feature.properties);
        const [lng, lat] = feature.geometry.coordinates;

        onChange({
            name: address,
            coordinates: { lat, lng },
        });

        setInputValue(address);
        setShowDropdown(false);
        setResults([]);
    }, [onChange]);

    // Get current location using Geolocation API
    const getCurrentLocation = useCallback(() => {
        if (!navigator.geolocation) {
            setLocationError("Geolocation not supported");
            return;
        }

        setIsLoadingLocation(true);
        setLocationError(null);
        setShowDropdown(false);

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;

                // Try reverse geocoding with Photon
                try {
                    const response = await fetch(
                        `https://photon.komoot.io/reverse?lat=${latitude}&lon=${longitude}`
                    );

                    if (response.ok) {
                        const data = await response.json();
                        if (data.features?.[0]) {
                            const address = formatAddress(data.features[0].properties);
                            onChange({
                                name: address,
                                coordinates: { lat: latitude, lng: longitude },
                            });
                            setInputValue(address);
                            setUserLocation({ lat: latitude, lng: longitude });
                            setIsLoadingLocation(false);
                            return;
                        }
                    }
                } catch {
                    // Fall through to coordinates
                }

                // Fallback to coordinates
                const locationName = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
                onChange({
                    name: locationName,
                    coordinates: { lat: latitude, lng: longitude },
                });
                setInputValue(locationName);
                setUserLocation({ lat: latitude, lng: longitude });
                setIsLoadingLocation(false);
            },
            (err) => {
                setIsLoadingLocation(false);
                switch (err.code) {
                    case err.PERMISSION_DENIED:
                        setLocationError("Location permission denied");
                        break;
                    case err.POSITION_UNAVAILABLE:
                        setLocationError("Location unavailable");
                        break;
                    case err.TIMEOUT:
                        setLocationError("Location request timed out");
                        break;
                    default:
                        setLocationError("Unable to get location");
                }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    }, [onChange]);

    // Clear location
    const clearLocation = useCallback(() => {
        onChange(undefined);
        setInputValue("");
        setResults([]);
        setShowDropdown(false);
        setLocationError(null);
        inputRef.current?.focus();
    }, [onChange]);

    return (
        <div className={cn("space-y-2", className)} ref={dropdownRef}>
            {label && (
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    {label}
                </label>
            )}

            <div className="flex gap-2">
                <div className="relative flex-1">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        {isSearching ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Search className="h-4 w-4" />
                        )}
                    </div>
                    <Input
                        ref={inputRef}
                        value={inputValue}
                        onChange={handleTextChange}
                        onFocus={() => results.length > 0 && setShowDropdown(true)}
                        placeholder={placeholder}
                        className="pl-9 pr-8"
                        autoComplete="off"
                    />
                    {inputValue && (
                        <button
                            type="button"
                            onClick={clearLocation}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}

                    {/* Search Results Dropdown */}
                    {showDropdown && results.length > 0 && (
                        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800 max-h-60 overflow-y-auto">
                            {results.map((feature, index) => {
                                const props = feature.properties;
                                const mainText = props.name || props.street || props.city || "Location";
                                const secondaryText = [props.city, props.state, props.country]
                                    .filter(Boolean)
                                    .join(", ");

                                return (
                                    <button
                                        key={index}
                                        type="button"
                                        onClick={() => selectResult(feature)}
                                        className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg"
                                    >
                                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" />
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium text-gray-900 dark:text-white truncate">
                                                {mainText}
                                            </p>
                                            {secondaryText && (
                                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                    {secondaryText}
                                                </p>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
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
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
            {locationError && !error && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                    {locationError}
                </p>
            )}
        </div>
    );
}
