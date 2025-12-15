import { formatCurrency, getCurrencySymbol, formatCurrencyWithSign, currencySymbols } from "@/lib/currency";

describe("currency utilities", () => {
    describe("formatCurrency", () => {
        it("formats USD correctly", () => {
            expect(formatCurrency(100, "USD")).toBe("$100.00");
            expect(formatCurrency(1234.56, "USD")).toBe("$1,234.56");
        });

        it("formats INR correctly", () => {
            const result = formatCurrency(100, "INR");
            expect(result).toContain("₹");
            expect(result).toContain("100");
        });

        it("formats EUR correctly", () => {
            const result = formatCurrency(100, "EUR");
            expect(result).toContain("€");
            expect(result).toContain("100");
        });

        it("formats GBP correctly", () => {
            const result = formatCurrency(100, "GBP");
            expect(result).toContain("£");
            expect(result).toContain("100");
        });

        it("formats JPY correctly", () => {
            const result = formatCurrency(100, "JPY");
            // JPY may use ¥ or ￥ depending on locale
            expect(result).toMatch(/¥|￥/);
        });

        it("defaults to USD when no currency provided", () => {
            expect(formatCurrency(50)).toBe("$50.00");
        });

        it("handles zero correctly", () => {
            expect(formatCurrency(0, "USD")).toBe("$0.00");
        });

        it("handles negative numbers", () => {
            const result = formatCurrency(-50, "USD");
            expect(result).toContain("50");
        });

        it("handles large numbers with proper formatting", () => {
            const result = formatCurrency(1000000, "USD");
            expect(result).toContain("1,000,000");
        });

        it("handles decimal precision", () => {
            expect(formatCurrency(10.5, "USD")).toBe("$10.50");
            expect(formatCurrency(10.555, "USD")).toBe("$10.56"); // Rounded
        });
    });

    describe("getCurrencySymbol", () => {
        it("returns correct symbol for USD", () => {
            expect(getCurrencySymbol("USD")).toBe("$");
        });

        it("returns correct symbol for EUR", () => {
            expect(getCurrencySymbol("EUR")).toBe("€");
        });

        it("returns correct symbol for GBP", () => {
            expect(getCurrencySymbol("GBP")).toBe("£");
        });

        it("returns correct symbol for INR", () => {
            expect(getCurrencySymbol("INR")).toBe("₹");
        });

        it("returns correct symbol for JPY", () => {
            expect(getCurrencySymbol("JPY")).toBe("¥");
        });

        it("defaults to $ for unknown currency", () => {
            expect(getCurrencySymbol("XYZ")).toBe("$");
        });

        it("defaults to $ when no currency provided", () => {
            expect(getCurrencySymbol()).toBe("$");
        });
    });

    describe("formatCurrencyWithSign", () => {
        it("adds + sign for positive amounts", () => {
            const result = formatCurrencyWithSign(100, "USD");
            expect(result).toBe("+$100.00");
        });

        it("adds - sign for negative amounts", () => {
            const result = formatCurrencyWithSign(-100, "USD");
            expect(result).toBe("-$100.00");
        });

        it("adds + sign for zero", () => {
            const result = formatCurrencyWithSign(0, "USD");
            expect(result).toBe("+$0.00");
        });

        it("works with different currencies", () => {
            const inrResult = formatCurrencyWithSign(500, "INR");
            expect(inrResult).toContain("+");
            expect(inrResult).toContain("₹");
        });
    });

    describe("currencySymbols", () => {
        it("has all expected currencies", () => {
            expect(currencySymbols).toHaveProperty("USD", "$");
            expect(currencySymbols).toHaveProperty("EUR", "€");
            expect(currencySymbols).toHaveProperty("GBP", "£");
            expect(currencySymbols).toHaveProperty("INR", "₹");
            expect(currencySymbols).toHaveProperty("CAD", "C$");
            expect(currencySymbols).toHaveProperty("AUD", "A$");
            expect(currencySymbols).toHaveProperty("JPY", "¥");
            expect(currencySymbols).toHaveProperty("CNY", "¥");
        });
    });
});

