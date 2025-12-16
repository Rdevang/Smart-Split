import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { COMPRESSION_THRESHOLD } from "@/lib/compression";

// Compressed data marker
const COMPRESSED_PREFIX = "__GZIP__";

/**
 * GET /api/cache/stats
 * View cache statistics and keys (for debugging)
 * Only works in development mode
 */
export async function GET() {
    // Only allow in development
    if (process.env.NODE_ENV === "production") {
        return NextResponse.json({
            error: "This endpoint is only available in development mode",
        }, { status: 403 });
    }

    const redis = getRedis();

    if (!redis) {
        return NextResponse.json({
            configured: false,
            message: "Redis is not configured",
        }, { status: 200 });
    }

    try {
        // Get all keys (limited scan)
        const keys: string[] = [];
        let cursor = "0";

        do {
            const result = await redis.scan(cursor, { count: 100 });
            cursor = String(result[0]);
            keys.push(...result[1]);
        } while (cursor !== "0" && keys.length < 100);

        // Get info about each key with compression stats
        let compressedCount = 0;
        let totalSizeUncompressed = 0;
        let totalSizeCompressed = 0;

        const keyInfo = await Promise.all(
            keys.slice(0, 20).map(async (key) => {
                const [ttl, value] = await Promise.all([
                    redis.ttl(key),
                    redis.get(key),
                ]);

                const valueStr = JSON.stringify(value);
                const size = Buffer.byteLength(valueStr, "utf-8");

                // Check if compressed
                const valueObj = value as Record<string, unknown> | null;
                const isCompressed = typeof value === "object" &&
                    valueObj !== null &&
                    "compressed" in valueObj &&
                    valueObj.compressed === true &&
                    typeof valueObj.data === "string" &&
                    (valueObj.data as string).startsWith(COMPRESSED_PREFIX);

                if (isCompressed) {
                    compressedCount++;
                    totalSizeCompressed += size;
                } else {
                    totalSizeUncompressed += size;
                }

                return {
                    key,
                    ttl: ttl === -1 ? "no expiry" : `${ttl}s`,
                    size: formatBytes(size),
                    compressed: isCompressed,
                };
            })
        );

        const totalSize = totalSizeCompressed + totalSizeUncompressed;

        return NextResponse.json({
            configured: true,
            totalKeys: keys.length,
            compression: {
                threshold: formatBytes(COMPRESSION_THRESHOLD),
                compressedKeys: compressedCount,
                uncompressedKeys: keyInfo.length - compressedCount,
                estimatedSavings: compressedCount > 0
                    ? `~${Math.round((1 - totalSizeCompressed / (totalSizeCompressed * 5)) * 100)}%`
                    : "N/A",
            },
            sampleKeys: keyInfo,
            totalSampleSize: formatBytes(totalSize),
            message: keys.length > 20 ? `Showing first 20 of ${keys.length} keys` : undefined,
        }, { status: 200 });
    } catch (error) {
        return NextResponse.json({
            configured: true,
            error: error instanceof Error ? error.message : "Unknown error",
        }, { status: 500 });
    }
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

