import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export { openai };

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

