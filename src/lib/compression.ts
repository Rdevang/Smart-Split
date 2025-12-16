import { gzipSync, gunzipSync, constants } from "zlib";

// ============================================
// COMPRESSION CONFIGURATION
// ============================================

// Only compress data larger than this threshold (bytes)
// Small data has overhead that can make it larger after compression
export const COMPRESSION_THRESHOLD = 1024; // 1KB

// Compression level (1-9, higher = better compression but slower)
// 6 is a good balance for real-time applications
const COMPRESSION_LEVEL = 6;

// Marker to identify compressed data in cache
const COMPRESSED_PREFIX = "__GZIP__";

// ============================================
// COMPRESSION UTILITIES
// ============================================

/**
 * Compress data if it exceeds the threshold
 * Returns either the original data or compressed string with prefix
 */
export function compressIfNeeded<T>(data: T): string {
    const jsonString = JSON.stringify(data);
    const byteSize = Buffer.byteLength(jsonString, "utf-8");

    // Only compress if above threshold
    if (byteSize < COMPRESSION_THRESHOLD) {
        return jsonString;
    }

    try {
        const compressed = gzipSync(jsonString, {
            level: COMPRESSION_LEVEL,
            memLevel: constants.Z_DEFAULT_MEMLEVEL,
        });

        // Convert to base64 for safe storage in Redis
        const compressedString = COMPRESSED_PREFIX + compressed.toString("base64");

        // Only use compression if it actually saves space
        if (compressedString.length < jsonString.length) {
            return compressedString;
        }

        // Compression didn't help (data already compact), return original
        return jsonString;
    } catch (error) {
        console.warn("Compression failed, using uncompressed data:", error);
        return jsonString;
    }
}

/**
 * Decompress data if it was compressed
 * Handles both compressed and uncompressed data transparently
 */
export function decompressIfNeeded<T>(data: string): T {
    // Check if data is compressed
    if (!data.startsWith(COMPRESSED_PREFIX)) {
        // Not compressed, parse normally
        return JSON.parse(data) as T;
    }

    try {
        // Remove prefix and decode base64
        const base64Data = data.slice(COMPRESSED_PREFIX.length);
        const buffer = Buffer.from(base64Data, "base64");

        // Decompress
        const decompressed = gunzipSync(buffer);
        return JSON.parse(decompressed.toString()) as T;
    } catch (error) {
        console.error("Decompression failed:", error);
        throw new Error("Failed to decompress cached data");
    }
}

/**
 * Get compression stats for debugging/monitoring
 */
export function getCompressionStats(
    originalData: unknown
): { originalSize: number; compressedSize: number; ratio: number; saved: number } {
    const jsonString = JSON.stringify(originalData);
    const originalSize = Buffer.byteLength(jsonString, "utf-8");

    if (originalSize < COMPRESSION_THRESHOLD) {
        return {
            originalSize,
            compressedSize: originalSize,
            ratio: 1,
            saved: 0,
        };
    }

    try {
        const compressed = gzipSync(jsonString, { level: COMPRESSION_LEVEL });
        const compressedSize = compressed.length;
        const ratio = compressedSize / originalSize;
        const saved = originalSize - compressedSize;

        return {
            originalSize,
            compressedSize,
            ratio: Math.round(ratio * 100) / 100,
            saved,
        };
    } catch {
        return {
            originalSize,
            compressedSize: originalSize,
            ratio: 1,
            saved: 0,
        };
    }
}

// ============================================
// EXAMPLES OF COMPRESSION SAVINGS
// ============================================
// 
// Typical compression ratios for different data types:
// 
// | Data Type          | Original | Compressed | Ratio |
// |--------------------|----------|------------|-------|
// | JSON (groups list) | 50KB     | ~8KB       | 0.16  |
// | Expenses array     | 100KB    | ~15KB      | 0.15  |
// | Analytics data     | 30KB     | ~5KB       | 0.17  |
// | User profile       | 2KB      | (skipped)  | N/A   |
// 
// Compression is most effective for:
// - Repetitive JSON structure (arrays of similar objects)
// - Large text content
// - Analytics/aggregate data
// 
// Less effective for:
// - Already compact data
// - Small payloads (<1KB)
// - Binary/image data (already compressed)

