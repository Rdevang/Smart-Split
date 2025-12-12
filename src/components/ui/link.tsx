"use client";

import NextLink from "next/link";
import { forwardRef, useCallback } from "react";
import { useNavigationProgress } from "@/components/layout/navigation-progress";

type LinkProps = React.ComponentProps<typeof NextLink>;

/**
 * Enhanced Link component that triggers the navigation progress bar
 * Use this instead of next/link for automatic loading indication
 */
const Link = forwardRef<HTMLAnchorElement, LinkProps>(
    ({ onClick, href, ...props }, ref) => {
        const { start } = useNavigationProgress();

        const handleClick = useCallback(
            (e: React.MouseEvent<HTMLAnchorElement>) => {
                // Don't trigger progress for:
                // - External links
                // - Anchor links (#)
                // - Same page navigation
                // - Modified clicks (ctrl, meta, shift)
                const isModifiedEvent = e.metaKey || e.ctrlKey || e.shiftKey;
                const isExternalLink = typeof href === "string" && (href.startsWith("http") || href.startsWith("//"));
                const isAnchorLink = typeof href === "string" && href.startsWith("#");

                if (!isModifiedEvent && !isExternalLink && !isAnchorLink) {
                    start();
                }

                onClick?.(e);
            },
            [href, onClick, start]
        );

        return <NextLink ref={ref} href={href} onClick={handleClick} {...props} />;
    }
);

Link.displayName = "Link";

export { Link };

