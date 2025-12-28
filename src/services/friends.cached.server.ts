import { cached, CacheKeys, CacheTTL, invalidateUserCache } from "@/lib/cache";
import { friendsServerService, type PastMember } from "./friends.server";

export const friendsCachedServerService = {
    /**
     * Get all people you've been in groups with (past co-members)
     * Cached version to prevent re-aggregating thousands of group members
     *
     * Cache key: user:{userId}:friends
     */
    async getPastGroupMembers(userId: string): Promise<PastMember[]> {
        return cached(
            CacheKeys.userFriends(userId),
            () => friendsServerService.getPastGroupMembers(userId),
            CacheTTL.MEDIUM // 5 minutes - friends list doesn't change THAT often
        );
    },

    /**
     * Invalidate friends cache
     */
    async invalidateFriends(userId: string): Promise<void> {
        await invalidateUserCache(userId);
    }
};

export type { PastMember } from "./friends.server";
