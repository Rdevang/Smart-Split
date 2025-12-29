import { parseExpenseFromText, suggestCategory, generateSpendingInsights } from "@/services/ai";

// Mock the AI client
jest.mock("@/lib/ai-client", () => ({
    geminiModel: {
        generateContent: jest.fn(),
    },
    geminiVisionModel: {
        generateContent: jest.fn(),
    },
    isAIConfigured: jest.fn(),
}));

import { geminiModel, isAIConfigured } from "@/lib/ai-client";

const mockGeminiModel = geminiModel as jest.Mocked<typeof geminiModel>;
const mockIsAIConfigured = isAIConfigured as jest.MockedFunction<typeof isAIConfigured>;

describe("AI Service", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("parseExpenseFromText", () => {
        it("throws error when AI is not configured", async () => {
            mockIsAIConfigured.mockReturnValue(false);

            await expect(parseExpenseFromText("Dinner 500")).rejects.toThrow(
                "Gemini API key is not configured"
            );
        });

        it("parses expense from natural language", async () => {
            mockIsAIConfigured.mockReturnValue(true);
            mockGeminiModel.generateContent.mockResolvedValue({
                response: {
                    text: () => JSON.stringify({
                        description: "Dinner at restaurant",
                        amount: 500,
                        category: "food",
                        date: "2024-01-15",
                        splitType: "equal",
                        participants: ["Mom"],
                        currency: "INR",
                        confidence: 0.9,
                    }),
                },
            } as never);

            const result = await parseExpenseFromText("Dinner 500 with Mom");

            expect(result).toEqual({
                description: "Dinner at restaurant",
                amount: 500,
                category: "food",
                date: "2024-01-15",
                splitType: "equal",
                participants: ["Mom"],
                currency: "INR",
                confidence: 0.9,
            });
        });

        it("cleans markdown code blocks from response", async () => {
            mockIsAIConfigured.mockReturnValue(true);
            mockGeminiModel.generateContent.mockResolvedValue({
                response: {
                    text: () => `\`\`\`json
{
  "description": "Uber ride",
  "amount": 200,
  "category": "transport",
  "date": "2024-01-15",
  "splitType": "equal",
  "participants": [],
  "currency": "INR",
  "confidence": 0.85
}
\`\`\``,
                },
            } as never);

            const result = await parseExpenseFromText("Uber 200");

            expect(result.description).toBe("Uber ride");
            expect(result.amount).toBe(200);
            expect(result.category).toBe("transport");
        });

        it("defaults to 'other' category when invalid category returned", async () => {
            mockIsAIConfigured.mockReturnValue(true);
            mockGeminiModel.generateContent.mockResolvedValue({
                response: {
                    text: () => JSON.stringify({
                        description: "Some expense",
                        amount: 100,
                        category: "invalid_category",
                        date: "2024-01-15",
                        splitType: "equal",
                        participants: [],
                        currency: "INR",
                        confidence: 0.7,
                    }),
                },
            } as never);

            const result = await parseExpenseFromText("Some expense 100");

            expect(result.category).toBe("other");
        });

        it("uses provided group members in prompt", async () => {
            mockIsAIConfigured.mockReturnValue(true);
            mockGeminiModel.generateContent.mockResolvedValue({
                response: {
                    text: () => JSON.stringify({
                        description: "Dinner",
                        amount: 500,
                        category: "food",
                        date: "2024-01-15",
                        splitType: "equal",
                        participants: ["Alice", "Bob"],
                        currency: "INR",
                        confidence: 0.9,
                    }),
                },
            } as never);

            await parseExpenseFromText("Dinner 500", ["Alice", "Bob", "Charlie"]);

            expect(mockGeminiModel.generateContent).toHaveBeenCalledWith(
                expect.stringContaining("Alice, Bob, Charlie")
            );
        });

        it("handles rate limit error", async () => {
            mockIsAIConfigured.mockReturnValue(true);
            mockGeminiModel.generateContent.mockRejectedValue(
                new Error("429 quota exceeded")
            );

            await expect(parseExpenseFromText("Dinner 500")).rejects.toThrow(
                "AI rate limit exceeded"
            );
        });

        it("handles invalid JSON response", async () => {
            mockIsAIConfigured.mockReturnValue(true);
            mockGeminiModel.generateContent.mockResolvedValue({
                response: {
                    text: () => "This is not valid JSON",
                },
            } as never);

            await expect(parseExpenseFromText("Dinner 500")).rejects.toThrow(
                "Failed to parse AI response"
            );
        });

        it("handles empty response", async () => {
            mockIsAIConfigured.mockReturnValue(true);
            mockGeminiModel.generateContent.mockResolvedValue({
                response: {
                    text: () => "",
                },
            } as never);

            await expect(parseExpenseFromText("Dinner 500")).rejects.toThrow(
                "No response from AI"
            );
        });

        it("provides default values for missing fields", async () => {
            mockIsAIConfigured.mockReturnValue(true);
            mockGeminiModel.generateContent.mockResolvedValue({
                response: {
                    text: () => JSON.stringify({
                        amount: 100,
                    }),
                },
            } as never);

            const result = await parseExpenseFromText("Something 100");

            expect(result.description).toBe("Something 100"); // Falls back to input text
            expect(result.category).toBe("other");
            expect(result.splitType).toBe("equal");
            expect(result.participants).toEqual([]);
            expect(result.currency).toBe("INR");
            expect(result.confidence).toBe(0.8);
        });
    });

    describe("suggestCategory", () => {
        it("returns 'other' when AI is not configured", async () => {
            mockIsAIConfigured.mockReturnValue(false);

            const result = await suggestCategory("Some expense");

            expect(result).toBe("other");
        });

        it("suggests valid category", async () => {
            mockIsAIConfigured.mockReturnValue(true);
            mockGeminiModel.generateContent.mockResolvedValue({
                response: {
                    text: () => "food",
                },
            } as never);

            const result = await suggestCategory("Dinner at restaurant");

            expect(result).toBe("food");
        });

        it("returns 'other' for invalid category", async () => {
            mockIsAIConfigured.mockReturnValue(true);
            mockGeminiModel.generateContent.mockResolvedValue({
                response: {
                    text: () => "invalid_category",
                },
            } as never);

            const result = await suggestCategory("Something");

            expect(result).toBe("other");
        });

        it("returns 'other' on error", async () => {
            mockIsAIConfigured.mockReturnValue(true);
            mockGeminiModel.generateContent.mockRejectedValue(new Error("API error"));

            const result = await suggestCategory("Something");

            expect(result).toBe("other");
        });
    });

    describe("generateSpendingInsights", () => {
        it("returns message when AI is not configured", async () => {
            mockIsAIConfigured.mockReturnValue(false);

            const result = await generateSpendingInsights([]);

            expect(result).toContain("AI is not configured");
        });

        it("returns message when no expenses", async () => {
            mockIsAIConfigured.mockReturnValue(true);

            const result = await generateSpendingInsights([]);

            expect(result).toContain("No expenses to analyze");
        });

        it("generates insights for expenses", async () => {
            mockIsAIConfigured.mockReturnValue(true);
            mockGeminiModel.generateContent.mockResolvedValue({
                response: {
                    text: () => "• You spent most on food\n• Consider reducing entertainment expenses",
                },
            } as never);

            const expenses = [
                { description: "Dinner", amount: 500, category: "food", date: "2024-01-15" },
                { description: "Movie", amount: 300, category: "entertainment", date: "2024-01-16" },
            ];

            const result = await generateSpendingInsights(expenses, "INR");

            expect(result).toContain("spent most on food");
        });

        it("returns fallback message on error", async () => {
            mockIsAIConfigured.mockReturnValue(true);
            mockGeminiModel.generateContent.mockRejectedValue(new Error("API error"));

            const expenses = [
                { description: "Dinner", amount: 500, category: "food", date: "2024-01-15" },
            ];

            const result = await generateSpendingInsights(expenses);

            expect(result).toContain("Unable to generate insights");
        });
    });
});

