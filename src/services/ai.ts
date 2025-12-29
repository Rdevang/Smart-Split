import { geminiModel, geminiVisionModel, isAIConfigured, ParsedExpense, ReceiptData } from "@/lib/ai-client";

const EXPENSE_CATEGORIES = [
    "food",
    "transport",
    "entertainment",
    "utilities",
    "rent",
    "shopping",
    "travel",
    "healthcare",
    "groceries",
    "other"
] as const;

/**
 * Parse natural language input into structured expense data
 * Examples:
 * - "Paid ₹500 for dinner with Mom and Dad, split equally"
 * - "Uber to airport $45, just me"
 * - "Movie tickets for 4 people, ₹800 total"
 */
export async function parseExpenseFromText(
    text: string,
    groupMembers?: string[]
): Promise<ParsedExpense> {
    // Check if AI is configured
    if (!isAIConfigured()) {
        throw new Error("Gemini API key is not configured. Please add GEMINI_API_KEY to your environment variables.");
    }

    const membersContext = groupMembers?.length
        ? `\nGroup members: ${groupMembers.join(", ")}`
        : "";

    const prompt = `You are an expense parser for a bill-splitting app. Parse the following expense description into structured JSON data.

Available categories: ${EXPENSE_CATEGORIES.join(", ")}
${membersContext}

Rules:
1. Extract the amount (look for ₹, $, €, £ or numbers)
2. Determine the most appropriate category from the list above
3. If names are mentioned, include them as participants array
4. Default splitType to "equal" unless specified otherwise
5. Use today's date (${new Date().toISOString().split("T")[0]}) if no date mentioned
6. Currency codes: INR for ₹, USD for $, EUR for €, GBP for £
7. Set confidence between 0 and 1 based on how clear the input is

Respond with ONLY valid JSON in this exact format, no markdown or extra text:
{
  "description": "string",
  "amount": number,
  "category": "string (one of the categories)",
  "date": "YYYY-MM-DD",
  "splitType": "equal" | "exact" | "percentage",
  "participants": ["array of names if mentioned"],
  "currency": "INR" | "USD" | "EUR" | "GBP",
  "confidence": number between 0 and 1
}

User input: "${text}"`;

    try {
        const result = await geminiModel.generateContent(prompt);
        const response = await result.response;
        const content = response.text();
        
        if (!content) {
            throw new Error("No response from AI");
        }

        // Clean the response - remove markdown code blocks if present
        let cleanedContent = content.trim();
        if (cleanedContent.startsWith("```json")) {
            cleanedContent = cleanedContent.slice(7);
        }
        if (cleanedContent.startsWith("```")) {
            cleanedContent = cleanedContent.slice(3);
        }
        if (cleanedContent.endsWith("```")) {
            cleanedContent = cleanedContent.slice(0, -3);
        }
        cleanedContent = cleanedContent.trim();

        const parsed = JSON.parse(cleanedContent);

        return {
            description: parsed.description || text,
            amount: parseFloat(parsed.amount) || 0,
            category: EXPENSE_CATEGORIES.includes(parsed.category) ? parsed.category : "other",
            date: parsed.date || new Date().toISOString().split("T")[0],
            splitType: parsed.splitType || "equal",
            participants: parsed.participants || [],
            currency: parsed.currency || "INR",
            confidence: parsed.confidence || 0.8,
        };
    } catch (error: unknown) {
        console.error("[AI Parse] Error:", error);
        // Handle specific errors
        if (error instanceof Error) {
            if (error.message.includes("API_KEY")) {
                throw new Error("Invalid Gemini API key. Please check your GEMINI_API_KEY.");
            }
            if (error.message.includes("quota") || error.message.includes("429")) {
                throw new Error("AI rate limit exceeded. Please try again in a moment.");
            }
            if (error.message.includes("JSON")) {
                throw new Error("Failed to parse AI response. Please try rephrasing your expense.");
            }
            throw error;
        }
        throw new Error("Failed to parse expense with AI");
    }
}

/**
 * Parse a receipt image into structured data
 * Uses Gemini Vision capabilities
 */
export async function parseReceiptImage(
    imageBase64: string,
    mimeType: string = "image/jpeg"
): Promise<ReceiptData> {
    if (!isAIConfigured()) {
        throw new Error("Gemini API key is not configured.");
    }

    const prompt = `You are a receipt parser. Extract all information from this receipt image.

Extract and respond with ONLY valid JSON in this exact format, no markdown:
{
  "merchant": "store/restaurant name",
  "total": total amount as number,
  "date": "YYYY-MM-DD",
  "items": [{"name": "item name", "quantity": 1, "price": 10.00}],
  "tax": tax amount or null,
  "tip": tip amount or null,
  "currency": "INR" | "USD" | "EUR" | "GBP"
}`;

    try {
        const result = await geminiVisionModel.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType: mimeType,
                    data: imageBase64,
                },
            },
        ]);
        
        const response = await result.response;
        const content = response.text();

        if (!content) {
            throw new Error("No response from AI");
        }

        // Clean the response
        let cleanedContent = content.trim();
        if (cleanedContent.startsWith("```json")) {
            cleanedContent = cleanedContent.slice(7);
        }
        if (cleanedContent.startsWith("```")) {
            cleanedContent = cleanedContent.slice(3);
        }
        if (cleanedContent.endsWith("```")) {
            cleanedContent = cleanedContent.slice(0, -3);
        }
        cleanedContent = cleanedContent.trim();

        const parsed = JSON.parse(cleanedContent);

        return {
            merchant: parsed.merchant || "Unknown",
            total: parseFloat(parsed.total) || 0,
            date: parsed.date || new Date().toISOString().split("T")[0],
            items: parsed.items || [],
            tax: parsed.tax ? parseFloat(parsed.tax) : undefined,
            tip: parsed.tip ? parseFloat(parsed.tip) : undefined,
            currency: parsed.currency || "INR",
        };
    } catch (error: unknown) {
        console.error("[AI Receipt] Error:", error);
        if (error instanceof Error) {
            throw error;
        }
        throw new Error("Failed to scan receipt");
    }
}

/**
 * Suggest category for an expense description
 */
export async function suggestCategory(description: string): Promise<string> {
    if (!isAIConfigured()) {
        return "other";
    }

    try {
        const prompt = `Categorize this expense into exactly one of these categories: ${EXPENSE_CATEGORIES.join(", ")}

Expense: "${description}"

Respond with ONLY the category name, nothing else.`;

        const result = await geminiModel.generateContent(prompt);
        const response = await result.response;
        const category = response.text()?.toLowerCase().trim() || "other";
        
        return EXPENSE_CATEGORIES.includes(category as typeof EXPENSE_CATEGORIES[number])
            ? category
            : "other";
    } catch {
        return "other";
    }
}

/**
 * Generate spending insights from expense data
 */
export async function generateSpendingInsights(
    expenses: Array<{ description: string; amount: number; category: string; date: string }>,
    currency: string = "INR"
): Promise<string> {
    if (!isAIConfigured()) {
        return "AI is not configured. Add your Gemini API key to enable insights.";
    }

    if (expenses.length === 0) {
        return "No expenses to analyze yet. Start adding expenses to get AI-powered insights!";
    }

    try {
        const prompt = `You are a helpful financial assistant. Analyze these expenses and provide brief, actionable insights.
Keep it concise (3-4 bullet points max). Be friendly and encouraging.
Currency: ${currency}

Expenses:
${JSON.stringify(expenses, null, 2)}`;

        const result = await geminiModel.generateContent(prompt);
        const response = await result.response;
        return response.text() || "Unable to generate insights.";
    } catch {
        return "Unable to generate insights at this time.";
    }
}
