"use client";

import { useState, useCallback, useEffect, useRef, useId } from "react";
import { Search, Filter, X, Calendar, Users, Tag, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export interface ActivityFiltersState {
    search: string;
    groupId: string;
    memberId: string;
    category: string;
    dateFrom: string;
    dateTo: string;
}

interface Group {
    id: string;
    name: string;
}

interface Member {
    id: string;
    name: string;
}

interface ActivityFiltersProps {
    filters: ActivityFiltersState;
    onFiltersChange: (filters: ActivityFiltersState) => void;
    groups: Group[];
    members: Member[];
    isLoading?: boolean;
}

const CATEGORY_OPTIONS = [
    { value: "", label: "All Categories" },
    { value: "expense", label: "Expenses" },
    { value: "settlement", label: "Settlements" },
    { value: "member", label: "Members" },
    { value: "group", label: "Groups" },
];

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(timer);
        };
    }, [value, delay]);

    return debouncedValue;
}

export function ActivityFilters({
    filters,
    onFiltersChange,
    groups,
    members,
    isLoading = false,
}: ActivityFiltersProps) {
    const [localSearch, setLocalSearch] = useState(filters.search);
    const [showFilters, setShowFilters] = useState(false);
    const filtersRef = useRef(filters);
    const onFiltersChangeRef = useRef(onFiltersChange);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const wasLoadingRef = useRef(false);
    const hadFocusRef = useRef(false);
    const searchInputId = useId();

    // Track focus state and restore after loading
    useEffect(() => {
        if (isLoading && !wasLoadingRef.current) {
            // Starting to load - check if search input had focus
            hadFocusRef.current = document.activeElement === searchInputRef.current;
        }
        if (!isLoading && wasLoadingRef.current && hadFocusRef.current) {
            // Loading finished and search input had focus - restore it using RAF for reliability
            requestAnimationFrame(() => {
                searchInputRef.current?.focus();
            });
            hadFocusRef.current = false;
        }
        wasLoadingRef.current = isLoading;
    }, [isLoading]);

    // Keep refs updated
    useEffect(() => {
        filtersRef.current = filters;
        onFiltersChangeRef.current = onFiltersChange;
    });

    // Debounce search input (500ms for better UX while typing)
    const debouncedSearch = useDebounce(localSearch, 500);

    // Update filters when debounced search changes
    useEffect(() => {
        if (debouncedSearch !== filtersRef.current.search) {
            onFiltersChangeRef.current({ ...filtersRef.current, search: debouncedSearch });
        }
    }, [debouncedSearch]);

    const handleFilterChange = useCallback(
        (key: keyof ActivityFiltersState, value: string) => {
            onFiltersChange({ ...filters, [key]: value });
        },
        [filters, onFiltersChange]
    );

    const clearFilters = useCallback(() => {
        setLocalSearch("");
        onFiltersChange({
            search: "",
            groupId: "",
            memberId: "",
            category: "",
            dateFrom: "",
            dateTo: "",
        });
    }, [onFiltersChange]);

    const hasActiveFilters =
        filters.groupId ||
        filters.memberId ||
        filters.category ||
        filters.dateFrom ||
        filters.dateTo ||
        filters.search;

    const activeFilterCount = [
        filters.groupId,
        filters.memberId,
        filters.category,
        filters.dateFrom || filters.dateTo,
        filters.search,
    ].filter(Boolean).length;

    const groupOptions = [
        { value: "", label: "All Groups" },
        ...groups.map((g) => ({ value: g.id, label: g.name })),
    ];

    const memberOptions = [
        { value: "", label: "All Members" },
        ...members.map((m) => ({ value: m.id, label: m.name })),
    ];

    return (
        <div className="space-y-4">
            {/* Search Bar */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                        ref={searchInputRef}
                        id={searchInputId}
                        type="text"
                        placeholder="Search activities..."
                        value={localSearch}
                        onChange={(e) => setLocalSearch(e.target.value)}
                        className="pl-10"
                    />
                    {localSearch && (
                        <button
                            type="button"
                            onClick={() => setLocalSearch("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
                <Button
                    variant={showFilters ? "primary" : "outline"}
                    onClick={() => setShowFilters(!showFilters)}
                    className="relative"
                >
                    <Filter className="h-4 w-4 mr-2" />
                    Filters
                    {activeFilterCount > 0 && (
                        <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-teal-500 text-xs text-white">
                            {activeFilterCount}
                        </span>
                    )}
                </Button>
            </div>

            {/* Filter Panel */}
            {showFilters && (
                <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {/* Group Filter */}
                        <div>
                            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                                <Users className="h-4 w-4" />
                                Group
                            </label>
                            <Select
                                value={filters.groupId}
                                onChange={(value) => handleFilterChange("groupId", value)}
                                options={groupOptions}
                                disabled={isLoading}
                            />
                        </div>

                        {/* Member Filter */}
                        <div>
                            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                                <User className="h-4 w-4" />
                                Member
                            </label>
                            <Select
                                value={filters.memberId}
                                onChange={(value) => handleFilterChange("memberId", value)}
                                options={memberOptions}
                                disabled={isLoading}
                            />
                        </div>

                        {/* Category Filter */}
                        <div>
                            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                                <Tag className="h-4 w-4" />
                                Category
                            </label>
                            <Select
                                value={filters.category}
                                onChange={(value) => handleFilterChange("category", value)}
                                options={CATEGORY_OPTIONS}
                                disabled={isLoading}
                            />
                        </div>

                        {/* Date Range */}
                        <div>
                            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                                <Calendar className="h-4 w-4" />
                                Date Range
                            </label>
                            <div className="flex gap-2">
                                <Input
                                    type="date"
                                    value={filters.dateFrom}
                                    onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
                                    className="text-sm"
                                    disabled={isLoading}
                                />
                                <Input
                                    type="date"
                                    value={filters.dateTo}
                                    onChange={(e) => handleFilterChange("dateTo", e.target.value)}
                                    className="text-sm"
                                    disabled={isLoading}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Clear Filters Button */}
                    {hasActiveFilters && (
                        <div className="mt-4 flex justify-end">
                            <Button variant="ghost" size="sm" onClick={clearFilters}>
                                <X className="h-4 w-4 mr-1" />
                                Clear all filters
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

