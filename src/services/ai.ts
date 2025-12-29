import { openai, ParsedExpense, ReceiptData } from "@/lib/openai";

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
    const membersContext = groupMembers?.length
        ? `\nGroup members: ${groupMembers.join(", ")}`
        : "";

    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content: `You are an expense parser for a bill-splitting app. Parse natural language expense descriptions into structured data.

Available categories: ${EXPENSE_CATEGORIES.join(", ")}
${membersContext}

Rules:
1. Extract the amount (look for ₹, $, €, £ or numbers)
2. Determine the most appropriate category
3. If names are mentioned, include them as participants
4. Default to "equal" split unless specified otherwise
5. Use today's date if no date mentioned
6. Currency codes: INR for ₹, USD for $, EUR for €, GBP for £

Respond with JSON only, no markdown.`,
            },
            {
                role: "user",
                content: text,
            },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
        throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);

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
}

/**
 * Parse a receipt image into structured data
 * Uses GPT-4o vision capabilities
 */
export async function parseReceiptImage(
    imageBase64: string,
    mimeType: string = "image/jpeg"
): Promise<ReceiptData> {
    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
            {
                role: "system",
                content: `You are a receipt parser. Extract all information from the receipt image.

Extract:
1. Merchant/store name
2. Total amount
3. Date (format: YYYY-MM-DD)
4. Individual items with name, quantity, and price
5. Tax amount if shown
6. Tip amount if shown
7. Currency (detect from symbols or context)

Respond with JSON only, no markdown.`,
            },
            {
                role: "user",
                content: [
                    {
                        type: "image_url",
                        image_url: {
                            url: `data:${mimeType};base64,${imageBase64}`,
                            detail: "high",
                        },
                    },
                    {
                        type: "text",
                        text: "Parse this receipt and extract all details.",
                    },
                ],
            },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
        throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);

    return {
        merchant: parsed.merchant || "Unknown",
        total: parseFloat(parsed.total) || 0,
        date: parsed.date || new Date().toISOString().split("T")[0],
        items: parsed.items || [],
        tax: parsed.tax ? parseFloat(parsed.tax) : undefined,
        tip: parsed.tip ? parseFloat(parsed.tip) : undefined,
        currency: parsed.currency || "INR",
    };
}

/**
 * Suggest category for an expense description
 */
export async function suggestCategory(description: string): Promise<string> {
    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content: `Categorize this expense into one of: ${EXPENSE_CATEGORIES.join(", ")}
Respond with just the category name, nothing else.`,
            },
            {
                role: "user",
                content: description,
            },
        ],
        temperature: 0,
        max_tokens: 20,
    });

    const category = response.choices[0]?.message?.content?.toLowerCase().trim() || "other";
    return EXPENSE_CATEGORIES.includes(category as typeof EXPENSE_CATEGORIES[number])
        ? category
        : "other";
}

/**
 * Generate spending insights from expense data
 */
export async function generateSpendingInsights(
    expenses: Array<{ description: string; amount: number; category: string; date: string }>,
    currency: string = "INR"
): Promise<string> {
    if (expenses.length === 0) {
        return "No expenses to analyze yet. Start adding expenses to get AI-powered insights!";
    }

    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content: `You are a helpful financial assistant. Analyze the user's expenses and provide brief, actionable insights.
Keep it concise (3-4 bullet points max). Be friendly and encouraging.
Currency: ${currency}`,
            },
            {
                role: "user",
                content: `Here are my recent expenses:\n${JSON.stringify(expenses, null, 2)}`,
            },
        ],
        temperature: 0.7,
        max_tokens: 300,
    });

    return response.choices[0]?.message?.content || "Unable to generate insights.";
}

