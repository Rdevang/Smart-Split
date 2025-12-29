import OpenAI from "openai";

// Check for API key
if (!process.env.OPENAI_API_KEY) {
    console.warn("[OpenAI] OPENAI_API_KEY is not set. AI features will not work.");
}

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "missing-key",
});

export { openai };

// Helper to check if OpenAI is configured
export function isOpenAIConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY;
}

// Types for AI-parsed expense
export interface ParsedExpense {
    description: string;
    amount: number;
    category: string;
    date: string; // ISO format
    splitType: "equal" | "exact" | "percentage";
    participants?: string[]; // Names mentioned
    currency?: string;
    confidence: number; // 0-1 confidence score
}

export interface ReceiptData {
    merchant: string;
    total: number;
    date: string;
    items: Array<{
        name: string;
        quantity: number;
        price: number;
    }>;
    tax?: number;
    tip?: number;
    currency?: string;
}

