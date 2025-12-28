"use client";

import NextLink from "next/link";
import { forwardRef, useCallback, useContext } from "react";
import { NavigationProgressContext } from "@/components/layout/navigation-progress";

type LinkProps = React.ComponentProps<typeof NextLink>;

/**
 * Enhanced Link component that triggers the navigation progress bar
 * Use this instead of next/link for automatic loading indication
 * 
 * Gracefully works without NavigationProgressProvider - just acts as regular link
 */
const Link = forwardRef<HTMLAnchorElement, LinkProps>(
    ({ onClick, href, ...props }, ref) => {
        // Use context directly to avoid throwing if provider is missing
        const context = useContext(NavigationProgressContext);

        const handleClick = useCallback(
            (e: React.MouseEvent<HTMLAnchorElement>) => {
                // Only trigger progress if context is available
                if (context) {
                    // Don't trigger progress for:
                    // - External links
                    // - Anchor links (#)
                    // - Modified clicks (ctrl, meta, shift)
                    const isModifiedEvent = e.metaKey || e.ctrlKey || e.shiftKey;
                    const isExternalLink = typeof href === "string" && (href.startsWith("http") || href.startsWith("//"));
                    const isAnchorLink = typeof href === "string" && href.startsWith("#");

                    if (!isModifiedEvent && !isExternalLink && !isAnchorLink) {
                        context.start();
                    }
                }

                onClick?.(e);
            },
            [href, onClick, context]
        );

        return <NextLink ref={ref} href={href} onClick={handleClick} {...props} />;
    }
);

Link.displayName = "Link";

export { Link };

