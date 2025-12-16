import {
    getCacheControl,
    getCacheHeaders,
    withCacheHeaders,
    type CacheProfile,
} from "@/lib/cache-headers";

describe("cache-headers utilities", () => {
    describe("getCacheControl", () => {
        describe("public-static profile", () => {
            it("returns correct cache-control for static content", () => {
                const result = getCacheControl("public-static");
                
                expect(result).toContain("public");
                expect(result).toContain("s-maxage=3600");
                expect(result).toContain("stale-while-revalidate=86400");
                expect(result).toContain("stale-if-error=604800");
            });

            it("has 1 week stale-if-error (604800 seconds)", () => {
                const result = getCacheControl("public-static");
                expect(result).toMatch(/stale-if-error=604800/);
            });
        });

        describe("public-dynamic profile", () => {
            it("returns correct cache-control for dynamic content", () => {
                const result = getCacheControl("public-dynamic");
                
                expect(result).toContain("public");
                expect(result).toContain("s-maxage=60");
                expect(result).toContain("stale-while-revalidate=300");
                expect(result).toContain("stale-if-error=86400");
            });

            it("has 1 day stale-if-error (86400 seconds)", () => {
                const result = getCacheControl("public-dynamic");
                expect(result).toMatch(/stale-if-error=86400/);
            });
        });

        describe("public-realtime profile", () => {
            it("returns correct cache-control for realtime content", () => {
                const result = getCacheControl("public-realtime");
                
                expect(result).toContain("public");
                expect(result).toContain("s-maxage=10");
                expect(result).toContain("stale-while-revalidate=30");
                expect(result).toContain("stale-if-error=3600");
            });

            it("has 1 hour stale-if-error (3600 seconds)", () => {
                const result = getCacheControl("public-realtime");
                expect(result).toMatch(/stale-if-error=3600/);
            });
        });

        describe("private profile", () => {
            it("returns private, no-cache for user-specific data", () => {
                const result = getCacheControl("private");
                
                expect(result).toBe("private, no-cache");
                expect(result).not.toContain("public");
                expect(result).not.toContain("stale-if-error");
            });
        });

        describe("no-store profile", () => {
            it("returns no-store for sensitive data", () => {
                const result = getCacheControl("no-store");
                
                expect(result).toBe("no-store, no-cache, must-revalidate");
                expect(result).not.toContain("public");
                expect(result).not.toContain("private");
            });

            it("prevents any caching", () => {
                const result = getCacheControl("no-store");
                
                expect(result).toContain("no-store");
                expect(result).toContain("no-cache");
                expect(result).toContain("must-revalidate");
            });
        });

        it("returns properly formatted comma-separated directives for public profiles", () => {
            const result = getCacheControl("public-dynamic");
            const parts = result.split(", ");
            
            expect(parts.length).toBe(4);
            expect(parts[0]).toBe("public");
        });
    });

    describe("getCacheHeaders", () => {
        it("returns headers object with Cache-Control", () => {
            const headers = getCacheHeaders("public-dynamic");
            
            expect(headers).toHaveProperty("Cache-Control");
            expect(headers["Cache-Control"]).toContain("public");
        });

        it("includes Vary header for Accept-Encoding", () => {
            const headers = getCacheHeaders("public-dynamic");
            
            expect(headers).toHaveProperty("Vary", "Accept-Encoding");
        });

        it("works with all cache profiles", () => {
            const profiles: CacheProfile[] = [
                "public-static",
                "public-dynamic",
                "public-realtime",
                "private",
                "no-store",
            ];

            profiles.forEach((profile) => {
                const headers = getCacheHeaders(profile);
                expect(headers).toHaveProperty("Cache-Control");
                expect(headers).toHaveProperty("Vary");
            });
        });

        it("returns consistent values on multiple calls", () => {
            const headers1 = getCacheHeaders("public-dynamic");
            const headers2 = getCacheHeaders("public-dynamic");
            
            expect(headers1["Cache-Control"]).toBe(headers2["Cache-Control"]);
        });
    });

    describe("withCacheHeaders", () => {
        it("adds cache headers to existing Headers object", () => {
            const existingHeaders = new Headers({
                "X-Custom-Header": "value",
            });
            
            const result = withCacheHeaders(existingHeaders, "public-dynamic");
            
            expect(result.get("X-Custom-Header")).toBe("value");
            expect(result.get("Cache-Control")).toContain("public");
            expect(result.get("Vary")).toBe("Accept-Encoding");
        });

        it("adds cache headers to plain object", () => {
            const existingHeaders = {
                "X-Custom-Header": "value",
            };
            
            const result = withCacheHeaders(existingHeaders, "public-static");
            
            expect(result.get("X-Custom-Header")).toBe("value");
            expect(result.get("Cache-Control")).toContain("s-maxage=3600");
        });

        it("overwrites existing Cache-Control header", () => {
            const existingHeaders = new Headers({
                "Cache-Control": "old-value",
            });
            
            const result = withCacheHeaders(existingHeaders, "no-store");
            
            expect(result.get("Cache-Control")).toBe("no-store, no-cache, must-revalidate");
        });

        it("returns a new Headers instance", () => {
            const existingHeaders = new Headers();
            const result = withCacheHeaders(existingHeaders, "private");
            
            expect(result).toBeInstanceOf(Headers);
            expect(result).not.toBe(existingHeaders);
        });
    });

    describe("cache profile values", () => {
        it("public-static has longest cache times (for landing pages)", () => {
            const staticHeader = getCacheControl("public-static");
            const dynamicHeader = getCacheControl("public-dynamic");
            
            // Static should have longer maxAge than dynamic
            expect(staticHeader).toMatch(/s-maxage=3600/);  // 1 hour
            expect(dynamicHeader).toMatch(/s-maxage=60/);   // 1 minute
        });

        it("stale-if-error times make sense for outage scenarios", () => {
            // Static: 1 week (604800s) - ok to serve week-old landing page
            // Dynamic: 1 day (86400s) - reasonable for health checks
            // Realtime: 1 hour (3600s) - minimal for live data
            
            const staticHeader = getCacheControl("public-static");
            const dynamicHeader = getCacheControl("public-dynamic");
            const realtimeHeader = getCacheControl("public-realtime");
            
            expect(staticHeader).toMatch(/stale-if-error=604800/);
            expect(dynamicHeader).toMatch(/stale-if-error=86400/);
            expect(realtimeHeader).toMatch(/stale-if-error=3600/);
        });

        it("private and no-store have no stale directives", () => {
            const privateHeader = getCacheControl("private");
            const noStoreHeader = getCacheControl("no-store");
            
            expect(privateHeader).not.toContain("stale");
            expect(noStoreHeader).not.toContain("stale");
        });
    });
});

