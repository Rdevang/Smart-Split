/**
 * UPI (Unified Payments Interface) utilities for payment integration
 * 
 * UPI URL scheme: upi://pay?pa=<UPI_ID>&pn=<Name>&am=<Amount>&cu=<Currency>&tn=<Note>
 */

export interface UPIPaymentParams {
    /** UPI ID of the payee (e.g., user@upi, 9876543210@paytm) */
    upiId: string;
    /** Name of the payee */
    payeeName: string;
    /** Amount to pay */
    amount: number;
    /** Currency code (default: INR) */
    currency?: string;
    /** Transaction note/description */
    note?: string;
}

/**
 * Validates a UPI ID format
 * Valid formats: user@upi, 9876543210@paytm, user.name@okicici, etc.
 */
export function isValidUpiId(upiId: string): boolean {
    if (!upiId || typeof upiId !== "string") return false;

    // UPI ID format: <username>@<bank/provider>
    // Username can contain alphanumeric, dots, hyphens
    // Provider is alphanumeric
    const upiRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/;
    return upiRegex.test(upiId.trim());
}

/**
 * Generates a UPI payment URL that can be opened by UPI apps
 * 
 * @example
 * const url = generateUpiUrl({
 *   upiId: 'john@upi',
 *   payeeName: 'John Doe',
 *   amount: 500,
 *   note: 'Smart Split settlement'
 * });
 * // Returns: upi://pay?pa=john@upi&pn=John%20Doe&am=500.00&cu=INR&tn=Smart%20Split%20settlement
 */
export function generateUpiUrl(params: UPIPaymentParams): string {
    const { upiId, payeeName, amount, currency = "INR", note = "Smart Split settlement" } = params;

    if (!isValidUpiId(upiId)) {
        throw new Error("Invalid UPI ID format");
    }

    if (amount <= 0) {
        throw new Error("Amount must be greater than 0");
    }

    // Build UPI URL with properly encoded parameters
    const urlParams = new URLSearchParams({
        pa: upiId.trim(),                    // Payee address (UPI ID)
        pn: payeeName.trim(),                // Payee name
        am: amount.toFixed(2),               // Amount with 2 decimal places
        cu: currency.toUpperCase(),          // Currency
        tn: note.trim(),                     // Transaction note
    });

    return `upi://pay?${urlParams.toString()}`;
}

/**
 * Opens UPI payment URL
 * On mobile: Opens UPI app chooser
 * On desktop: Shows alert (UPI only works on mobile)
 */
export function openUpiPayment(params: UPIPaymentParams): boolean {
    try {
        const upiUrl = generateUpiUrl(params);

        // Check if we're on mobile (UPI only works on mobile devices)
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

        if (!isMobile) {
            // On desktop, we can't open UPI apps
            // Return false to indicate the caller should show an alternative
            return false;
        }

        // Open UPI URL - this will trigger the app chooser on Android/iOS
        window.location.href = upiUrl;
        return true;
    } catch (error) {
        console.error("Failed to open UPI payment:", error);
        return false;
    }
}

/**
 * Generates a WhatsApp share link with payment request
 */
export function generatePaymentRequestLink(params: {
    payeeName: string;
    amount: number;
    currency: string;
    upiId?: string;
}): string {
    const { payeeName, amount, currency, upiId } = params;

    let message = `Hi! Please pay ${currency} ${amount.toFixed(2)} to ${payeeName} for Smart Split settlement.`;

    if (upiId) {
        message += `\n\nUPI ID: ${upiId}`;
    }

    return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

