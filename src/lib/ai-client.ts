import { GoogleGenerativeAI } from "@google/generative-ai";

// Check for API key
if (!process.env.GEMINI_API_KEY) {
    console.warn("[Gemini] GEMINI_API_KEY is not set. AI features will not work.");
}

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "missing-key");

// Get the model - using gemini-2.5-flash (newest, may have separate quota)
export const geminiModel = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
});

// For vision tasks (receipt scanning) - same model supports vision
export const geminiVisionModel = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
});

export { genAI };

// Helper to check if AI is configured
export function isAIConfigured(): boolean {
    return !!process.env.GEMINI_API_KEY;
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

