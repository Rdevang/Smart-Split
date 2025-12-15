/**
 * Currency formatting utilities
 */

export const currencySymbols: Record<string, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    INR: "₹",
    CAD: "C$",
    AUD: "A$",
    JPY: "¥",
    CNY: "¥",
};

export const currencyLocales: Record<string, string> = {
    USD: "en-US",
    EUR: "de-DE",
    GBP: "en-GB",
    INR: "en-IN",
    CAD: "en-CA",
    AUD: "en-AU",
    JPY: "ja-JP",
    CNY: "zh-CN",
};

/**
 * Format amount with currency symbol
 */
export function formatCurrency(amount: number, currency: string = "USD"): string {
    const locale = currencyLocales[currency] || "en-US";

    try {
        return new Intl.NumberFormat(locale, {
            style: "currency",
            currency: currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);
    } catch {
        // Fallback if currency code is invalid
        const symbol = currencySymbols[currency] || "$";
        return `${symbol}${amount.toFixed(2)}`;
    }
}

/**
 * Get currency symbol only
 */
export function getCurrencySymbol(currency: string = "USD"): string {
    return currencySymbols[currency] || "$";
}

/**
 * Format amount with sign (+ or -)
 */
export function formatCurrencyWithSign(amount: number, currency: string = "USD"): string {
    const formatted = formatCurrency(Math.abs(amount), currency);
    if (amount >= 0) {
        return `+${formatted}`;
    }
    return `-${formatted}`;
}

