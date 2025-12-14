import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://smart-split-one.vercel.app";

    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                disallow: [
                    "/dashboard",
                    "/groups",
                    "/expenses",
                    "/activity",
                    "/settings",
                    "/auth/callback",
                    "/api/",
                ],
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}

