## 2024-05-22 - [Pattern: Cached Service Wrappers]
**Learning:** This codebase uses a pattern of wrapping 'raw' server services (which access the DB directly) with a 'cached' service wrapper. This wrapper handles Redis caching, TTLs, and invalidation keys. This separates data fetching logic from caching policy.
**Action:** When optimizing a slow server-side data fetch, look for the corresponding `*.server.ts` file and create (or update) a `*.cached.server.ts` wrapper using the `cached()` utility from `src/lib/cache.ts`. Don't forget to register new keys in `src/lib/cache.ts`.
