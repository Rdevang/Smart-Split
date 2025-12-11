/**
 * Debt Simplification Algorithm
 * 
 * Minimizes the number of transactions needed to settle all debts in a group.
 * Uses a greedy approach: always match the largest creditor with the largest debtor.
 * 
 * Time Complexity: O(n log n) where n is the number of members
 * Space Complexity: O(n)
 */

export interface Balance {
    user_id: string;
    user_name: string;
    balance: number;
    is_placeholder?: boolean;
}

export interface SimplifiedPayment {
    from_user_id: string;
    from_user_name: string;
    to_user_id: string;
    to_user_name: string;
    amount: number;
    from_is_placeholder?: boolean;
    to_is_placeholder?: boolean;
}

/**
 * Simplifies debts by minimizing the number of transactions.
 * 
 * Algorithm:
 * 1. Separate members into creditors (positive balance) and debtors (negative balance)
 * 2. Sort both lists by absolute amount (descending)
 * 3. Match largest debtor with largest creditor
 * 4. Create payment for min(debt, credit)
 * 5. Repeat until all debts are settled
 * 
 * @param balances - Array of member balances (positive = owed money, negative = owes money)
 * @returns Array of simplified payments
 */
export function simplifyDebts(balances: Balance[]): SimplifiedPayment[] {
    const payments: SimplifiedPayment[] = [];

    // Filter out zero balances and separate into creditors and debtors
    const creditors: Balance[] = []; // People who are owed money (positive balance)
    const debtors: Balance[] = [];   // People who owe money (negative balance)

    for (const balance of balances) {
        // Round to 2 decimal places to avoid floating point issues
        const amount = Math.round(balance.balance * 100) / 100;

        if (amount > 0.01) {
            creditors.push({ ...balance, balance: amount });
        } else if (amount < -0.01) {
            debtors.push({ ...balance, balance: Math.abs(amount) });
        }
    }

    // Sort by amount (largest first) for optimal matching
    creditors.sort((a, b) => b.balance - a.balance);
    debtors.sort((a, b) => b.balance - a.balance);

    // Use two pointers to match debtors with creditors
    let i = 0; // creditor index
    let j = 0; // debtor index

    while (i < creditors.length && j < debtors.length) {
        const creditor = creditors[i];
        const debtor = debtors[j];

        // Amount to transfer is minimum of what debtor owes and creditor is owed
        const amount = Math.min(creditor.balance, debtor.balance);

        if (amount > 0.01) {
            payments.push({
                from_user_id: debtor.user_id,
                from_user_name: debtor.user_name,
                to_user_id: creditor.user_id,
                to_user_name: creditor.user_name,
                amount: Math.round(amount * 100) / 100,
                from_is_placeholder: debtor.is_placeholder,
                to_is_placeholder: creditor.is_placeholder,
            });
        }

        // Update remaining balances
        creditor.balance -= amount;
        debtor.balance -= amount;

        // Move to next creditor/debtor if fully settled
        if (creditor.balance < 0.01) i++;
        if (debtor.balance < 0.01) j++;
    }

    return payments;
}

/**
 * Calculates the total number of payments before and after simplification
 */
export function getSimplificationStats(balances: Balance[]): {
    originalPayments: number;
    simplifiedPayments: number;
    savings: number;
} {
    // Original payments would be n*(n-1)/2 in worst case (everyone owes everyone)
    // But more realistically, it's the sum of all individual expense splits
    const nonZeroBalances = balances.filter(b => Math.abs(b.balance) > 0.01);
    const originalPayments = Math.max(0, nonZeroBalances.length - 1);

    const simplified = simplifyDebts(balances);
    const simplifiedPayments = simplified.length;

    return {
        originalPayments,
        simplifiedPayments,
        savings: Math.max(0, originalPayments - simplifiedPayments),
    };
}

/**
 * Formats a payment as a human-readable string
 */
export function formatPayment(payment: SimplifiedPayment, currency: string = "USD"): string {
    const formatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
    });

    return `${payment.from_user_name} pays ${payment.to_user_name} ${formatter.format(payment.amount)}`;
}

