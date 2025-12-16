"use client";

import { useOptimistic, useTransition, useCallback } from "react";

// ============================================
// OPTIMISTIC ACTION HOOK
// ============================================
// Makes mutations feel instant by updating UI before server responds
// If server fails, automatically reverts to previous state

export interface OptimisticActionOptions<TData, TInput> {
    /** Current data state */
    data: TData;
    /** Function to optimistically update data */
    updateFn: (current: TData, input: TInput) => TData;
    /** Async action to perform on server */
    action: (input: TInput) => Promise<{ success: boolean; error?: string }>;
    /** Callback on success */
    onSuccess?: (input: TInput) => void;
    /** Callback on error */
    onError?: (error: string, input: TInput) => void;
}

export interface OptimisticActionResult<TData, TInput> {
    /** Current optimistic data (may differ from server state temporarily) */
    optimisticData: TData;
    /** Whether an action is in progress */
    isPending: boolean;
    /** Execute the optimistic action */
    execute: (input: TInput) => void;
}

/**
 * Hook for optimistic UI updates
 * 
 * @example
 * ```tsx
 * const { optimisticData, isPending, execute } = useOptimisticAction({
 *     data: profile,
 *     updateFn: (current, input) => ({ ...current, ...input }),
 *     action: async (input) => {
 *         const result = await updateProfile(input);
 *         return { success: !result.error, error: result.error };
 *     },
 *     onSuccess: () => toast.success("Profile updated!"),
 *     onError: (error) => toast.error(error),
 * });
 * ```
 */
export function useOptimisticAction<TData, TInput>({
    data,
    updateFn,
    action,
    onSuccess,
    onError,
}: OptimisticActionOptions<TData, TInput>): OptimisticActionResult<TData, TInput> {
    const [isPending, startTransition] = useTransition();
    const [optimisticData, setOptimisticData] = useOptimistic(data, updateFn);

    const execute = useCallback(
        (input: TInput) => {
            startTransition(async () => {
                // Optimistically update UI immediately
                setOptimisticData(input);

                // Perform actual server action
                const result = await action(input);

                if (result.success) {
                    onSuccess?.(input);
                } else {
                    // On error, React automatically reverts optimistic state
                    onError?.(result.error || "An error occurred", input);
                }
            });
        },
        [action, onSuccess, onError, setOptimisticData]
    );

    return {
        optimisticData,
        isPending,
        execute,
    };
}

// ============================================
// OPTIMISTIC LIST HOOK
// ============================================
// For list operations (add, remove, update items)

export type ListAction<T> =
    | { type: "add"; item: T }
    | { type: "remove"; id: string }
    | { type: "update"; id: string; updates: Partial<T> };

export interface OptimisticListOptions<T extends { id: string }> {
    items: T[];
    action: (listAction: ListAction<T>) => Promise<{ success: boolean; error?: string }>;
    onSuccess?: (listAction: ListAction<T>) => void;
    onError?: (error: string, listAction: ListAction<T>) => void;
}

/**
 * Hook for optimistic list operations
 * 
 * @example
 * ```tsx
 * const { optimisticItems, isPending, addItem, removeItem, updateItem } = useOptimisticList({
 *     items: expenses,
 *     action: async (action) => {
 *         if (action.type === 'remove') {
 *             return await deleteExpense(action.id);
 *         }
 *         // ... handle other actions
 *     },
 *     onSuccess: () => toast.success("Done!"),
 *     onError: (error) => toast.error(error),
 * });
 * ```
 */
export function useOptimisticList<T extends { id: string }>({
    items,
    action,
    onSuccess,
    onError,
}: OptimisticListOptions<T>) {
    const [isPending, startTransition] = useTransition();

    const [optimisticItems, setOptimisticItems] = useOptimistic(
        items,
        (current: T[], listAction: ListAction<T>) => {
            switch (listAction.type) {
                case "add":
                    return [...current, listAction.item];
                case "remove":
                    return current.filter((item) => item.id !== listAction.id);
                case "update":
                    return current.map((item) =>
                        item.id === listAction.id
                            ? { ...item, ...listAction.updates }
                            : item
                    );
                default:
                    return current;
            }
        }
    );

    const executeAction = useCallback(
        (listAction: ListAction<T>) => {
            startTransition(async () => {
                setOptimisticItems(listAction);

                const result = await action(listAction);

                if (result.success) {
                    onSuccess?.(listAction);
                } else {
                    onError?.(result.error || "An error occurred", listAction);
                }
            });
        },
        [action, onSuccess, onError, setOptimisticItems]
    );

    const addItem = useCallback(
        (item: T) => executeAction({ type: "add", item }),
        [executeAction]
    );

    const removeItem = useCallback(
        (id: string) => executeAction({ type: "remove", id }),
        [executeAction]
    );

    const updateItem = useCallback(
        (id: string, updates: Partial<T>) =>
            executeAction({ type: "update", id, updates }),
        [executeAction]
    );

    return {
        optimisticItems,
        isPending,
        addItem,
        removeItem,
        updateItem,
    };
}

// ============================================
// OPTIMISTIC TOGGLE HOOK
// ============================================
// For simple boolean toggles (like/unlike, follow/unfollow, settle/unsettle)

export interface OptimisticToggleOptions {
    initialState: boolean;
    action: (newState: boolean) => Promise<{ success: boolean; error?: string }>;
    onSuccess?: (newState: boolean) => void;
    onError?: (error: string) => void;
}

/**
 * Hook for optimistic toggle actions
 * 
 * @example
 * ```tsx
 * const { isActive, isPending, toggle } = useOptimisticToggle({
 *     initialState: isSettled,
 *     action: async (newState) => {
 *         return await markSettled(debtId, newState);
 *     },
 *     onSuccess: () => toast.success("Updated!"),
 * });
 * ```
 */
export function useOptimisticToggle({
    initialState,
    action,
    onSuccess,
    onError,
}: OptimisticToggleOptions) {
    const [isPending, startTransition] = useTransition();
    const [optimisticState, setOptimisticState] = useOptimistic(
        initialState,
        (_current: boolean, newState: boolean) => newState
    );

    const toggle = useCallback(() => {
        const newState = !optimisticState;

        startTransition(async () => {
            setOptimisticState(newState);

            const result = await action(newState);

            if (result.success) {
                onSuccess?.(newState);
            } else {
                onError?.(result.error || "An error occurred");
            }
        });
    }, [optimisticState, action, onSuccess, onError, setOptimisticState]);

    return {
        isActive: optimisticState,
        isPending,
        toggle,
    };
}

