import { getRedis } from "./redis";

// ============================================
// DISTRIBUTED LOCKING (REDLOCK PATTERN)
// ============================================
// Prevents race conditions in critical operations like:
// - Settlement recording (prevent double-settle)
// - Group membership changes
// - Expense modifications
// - Any operation that needs atomicity

export interface LockOptions {
    /** Time in seconds before lock auto-expires (safety net) */
    ttl?: number;
    /** Time in ms to wait before retrying to acquire lock */
    retryDelay?: number;
    /** Maximum number of retry attempts */
    maxRetries?: number;
}

const DEFAULT_OPTIONS: Required<LockOptions> = {
    ttl: 10,           // Lock expires in 10 seconds (safety)
    retryDelay: 100,   // Wait 100ms between retries
    maxRetries: 5,     // Try 5 times before giving up
};

export interface LockResult {
    acquired: boolean;
    lockId: string | null;
}

/**
 * Acquire a distributed lock
 * 
 * @param key - Unique identifier for the resource being locked
 * @param options - Lock configuration options
 * @returns Lock result with acquired status and lock ID
 */
export async function acquireLock(
    key: string,
    options: LockOptions = {}
): Promise<LockResult> {
    const redis = getRedis();

    // If Redis not available, allow operation (fail open)
    // Note: This means no lock protection without Redis
    if (!redis) {
        console.warn("⚠️ Redis not available, proceeding without lock for:", key);
        return { acquired: true, lockId: null };
    }

    const opts = { ...DEFAULT_OPTIONS, ...options };
    const lockKey = `lock:${key}`;
    const lockId = generateLockId();

    for (let attempt = 0; attempt < opts.maxRetries; attempt++) {
        try {
            // Try to acquire lock (NX = only if not exists)
            const result = await redis.set(lockKey, lockId, {
                nx: true,
                ex: opts.ttl,
            });

            if (result === "OK") {
                return { acquired: true, lockId };
            }

            // Lock held by someone else - wait and retry
            if (attempt < opts.maxRetries - 1) {
                await sleep(opts.retryDelay);
            }
        } catch (error) {
            console.error("[Lock] Acquisition error for:", key, error);
            // On error, fail open (allow operation)
            return { acquired: true, lockId: null };
        }
    }

    // Failed to acquire lock after all retries
    return { acquired: false, lockId: null };
}

/**
 * Release a distributed lock
 * 
 * @param key - Resource key
 * @param lockId - Lock ID returned from acquireLock (ensures we only release our own lock)
 */
export async function releaseLock(key: string, lockId: string | null): Promise<void> {
    if (!lockId) return; // No lock to release (Redis was unavailable)

    const redis = getRedis();
    if (!redis) return;

    const lockKey = `lock:${key}`;

    try {
        // Only delete if we own the lock (prevents releasing someone else's lock)
        const currentOwner = await redis.get(lockKey);
        if (currentOwner === lockId) {
            await redis.del(lockKey);
        }
    } catch (error) {
        console.error("[Lock] Release error for:", key, error);
        // Ignore release errors - lock will expire anyway
    }
}

/**
 * Execute a function with a distributed lock
 * Automatically acquires and releases the lock
 * 
 * @example
 * ```typescript
 * const result = await withLock(
 *     `settlement:${groupId}:${fromUser}:${toUser}`,
 *     async () => {
 *         // Check if already settled
 *         const existing = await checkExistingSettlement();
 *         if (existing) throw new Error("Already settled");
 *         
 *         // Process settlement
 *         return await recordSettlement();
 *     },
 *     { ttl: 15 }
 * );
 * ```
 */
export async function withLock<T>(
    key: string,
    fn: () => Promise<T>,
    options: LockOptions = {}
): Promise<T> {
    const { acquired, lockId } = await acquireLock(key, options);

    if (!acquired) {
        throw new Error(
            `Resource is currently being processed by another request. Please try again.`
        );
    }

    try {
        return await fn();
    } finally {
        await releaseLock(key, lockId);
    }
}

// ============================================
// LOCK KEY GENERATORS
// ============================================
// Use these to generate consistent lock keys for different operations

export const LockKeys = {
    /** Lock for settlement operations */
    settlement: (groupId: string, fromUser: string, toUser: string) =>
        `settlement:${groupId}:${fromUser}:${toUser}`,

    /** Lock for expense operations in a group */
    expense: (groupId: string, expenseId?: string) =>
        expenseId ? `expense:${groupId}:${expenseId}` : `expense:${groupId}:new`,

    /** Lock for bulk expense creation (prevent duplicate batch submissions) */
    bulkExpense: (groupId: string, userId: string) =>
        `bulk-expense:${groupId}:${userId}`,

    /** Lock for group membership changes */
    membership: (groupId: string, userId: string) =>
        `membership:${groupId}:${userId}`,

    /** Lock for invite code operations */
    inviteCode: (groupId: string) =>
        `invite:${groupId}`,

    /** Lock for balance calculations (prevent concurrent recalculations) */
    balanceCalc: (groupId: string) =>
        `balance-calc:${groupId}`,
} as const;

// ============================================
// HELPERS
// ============================================

function generateLockId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// USAGE EXAMPLES
// ============================================
// 
// Example 1: Prevent double settlement
// 
// async function recordSettlement(groupId, fromUser, toUser, amount) {
//     return withLock(
//         LockKeys.settlement(groupId, fromUser, toUser),
//         async () => {
//             // Check if already settled (inside lock = safe)
//             const existing = await getExistingSettlement(groupId, fromUser, toUser);
//             if (existing) {
//                 throw new Error("This debt has already been settled");
//             }
//             
//             // Process settlement (guaranteed single execution)
//             return await createSettlement(groupId, fromUser, toUser, amount);
//         }
//     );
// }
// 
// Example 2: Prevent duplicate expense creation
// 
// async function addExpense(groupId, expenseData) {
//     return withLock(
//         LockKeys.expense(groupId),
//         async () => {
//             // Check for duplicate (e.g., same description, amount, date)
//             const duplicate = await checkDuplicateExpense(groupId, expenseData);
//             if (duplicate) {
//                 throw new Error("This expense may be a duplicate");
//             }
//             
//             return await createExpense(groupId, expenseData);
//         },
//         { ttl: 5 }  // Shorter lock for expense creation
//     );
// }
// 
// Example 3: Prevent concurrent balance recalculations
// 
// async function recalculateBalances(groupId) {
//     return withLock(
//         LockKeys.balanceCalc(groupId),
//         async () => {
//             return await computeGroupBalances(groupId);
//         },
//         { ttl: 30 }  // Longer lock for expensive computation
//     );
// }

