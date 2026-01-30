/**
 * POST /api/ai/scan-receipt
 * 
 * Scans a receipt image using AI to extract expense data.
 * Requires authentication and validates file type/size.
 */

import { NextResponse } from "next/server";
import { createRoute, withAuth, withRateLimitByUser, ApiResponse, ApiError } from "@/lib/api";
import { parseReceiptImage } from "@/services/ai";
import { aiLog } from "@/lib/console-logger";

// Valid image types
const VALID_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const POST = createRoute()
    .use(withAuth())
    .use(withRateLimitByUser("expensive")) // AI calls are expensive
    .handler(async (ctx) => {
        try {
            // Parse form data (can't use withValidation for FormData)
            const formData = await ctx.request.formData();
            const file = formData.get("receipt") as File | null;

            if (!file) {
                return ApiError.badRequest("Receipt image is required");
            }

            // Validate file type
            if (!VALID_IMAGE_TYPES.includes(file.type)) {
                return ApiError.badRequest("Invalid file type. Please upload a JPEG, PNG, or WebP image.");
            }

            // Validate file size
            if (file.size > MAX_FILE_SIZE) {
                return ApiError.custom(413, "File too large. Maximum size is 10MB.", "PAYLOAD_TOO_LARGE");
            }

            // Convert file to base64
            const bytes = await file.arrayBuffer();
            const buffer = Buffer.from(bytes);
            const base64 = buffer.toString("base64");

            // Parse the receipt using AI
            const receiptData = await parseReceiptImage(base64, file.type);

            return ApiResponse.success({
                success: true,
                receipt: receiptData,
            });
        } catch (error) {
            aiLog.error("Receipt scan failed", error);

            // Check for specific AI errors
            if (error instanceof Error) {
                if (error.message.includes("rate limit")) {
                    return ApiError.rateLimited(60);
                }
                if (error.message.includes("invalid image")) {
                    return ApiError.badRequest("Could not process the image. Please try a clearer photo.");
                }
            }

            return ApiError.internal("Failed to scan receipt");
        }
    });
