// // src/services/activeFeedingCache.ts
// import { LRUCache } from "lru-cache";
// import { FeedingStatus } from "@prisma/client";
// import { prisma } from "../lib/prisma.js";
export {};
// export interface ActiveFeeding {
//   feedingId: string;
//   horseId: string;
//   deviceId: string;
//   ownerId: string;
//   status: "PENDING" | "STARTED" | "RUNNING" | "COMPLETED" | "FAILED";
//   startedAt?: Date;
//   requestedKg: number;
// }
// /**
//  * In-memory cache for active feedings
//  *
//  * PURPOSE:
//  * - Fast reads (memory access is 100x faster than DB)
//  * - Reduces DB load for frequent polling (getHorsesStats API)
//  * - Non-blocking writes (updates happen async)
//  *
//  * PERSISTENCE:
//  * - Cache is backed by DB (activeFeeding table)
//  * - Survives server restarts via cache warming
//  * - DB is source of truth, cache is performance layer
//  *
//  * CONFIGURATION:
//  * - Max 1000 concurrent feedings
//  * - Auto-expires after 30 minutes (safety for stuck feedings)
//  * - Key: horseId (one active feeding per horse)
//  */
// export const activeFeedingCache = new LRUCache<string, ActiveFeeding>({
//   max: 1000,
//   ttl: 1000 * 60 * 30, // 30 minutes safety TTL
//   updateAgeOnGet: false, // Don't refresh TTL on read
//   updateAgeOnHas: false, // Don't refresh TTL on check
//   // Callback when entries are removed (eviction or expiry)
//   dispose: (_, key, reason) => {
//     if (reason === "evict" || reason === "expire") {
//       // Clean up DB if cache entry expired (safety cleanup)
//       (async () => {
//         try {
//           await prisma.activeFeeding.delete({
//             where: { horseId: key },
//           });
//         } catch (err) {
//           console.error(
//             `❌ Failed to cleanup expired feeding in DB (${key}):`,
//             err,
//           );
//         }
//       })();
//     }
//   },
// });
// // ============================================================================
// // HELPER FUNCTIONS - HYBRID CACHE + DB APPROACH
// // ============================================================================
// /**
//  * Set active feeding (CREATE operation)
//  *
//  * WHAT IT DOES:
//  * 1. Writes to cache immediately (fast, in-memory)
//  * 2. Writes to DB asynchronously (persistence, non-blocking)
//  *
//  * USE CASE:
//  * - Called when user starts a new feeding
//  * - Called when cache is being warmed from DB on startup
//  *
//  * PERFORMANCE:
//  * - Returns instantly (cache write is synchronous)
//  * - DB write happens in background (fire-and-forget)
//  *
//  * @param horseId - Unique identifier for the horse
//  * @param feeding - Active feeding data to store
//  */
// export function setActiveFeeding(
//   horseId: string,
//   feeding: ActiveFeeding,
// ): void {
//   // STEP 1: Update cache (instant, synchronous)
//   activeFeedingCache.set(horseId, feeding);
//   // STEP 2: Persist to DB (async, non-blocking, fire-and-forget)
//   (async () => {
//     try {
//       await prisma.activeFeeding.upsert({
//         where: { horseId },
//         create: {
//           horseId,
//           deviceId: feeding.deviceId,
//           feedingId: feeding.feedingId,
//           status: feeding.status as FeedingStatus,
//           requestedKg: feeding.requestedKg,
//           startedAt: feeding.startedAt || null,
//         },
//         update: {
//           feedingId: feeding.feedingId,
//           status: feeding.status as FeedingStatus,
//           requestedKg: feeding.requestedKg,
//           startedAt: feeding.startedAt || null,
//         },
//       });
//     } catch (err) {
//       //this is a critical error because could be for duplicating fields in case of the schedualing and manual
//       throw err;
//     }
//   })();
// }
// /**
//  * Get active feeding (READ operation) - Synchronous version
//  *
//  * WHAT IT DOES:
//  * - Only reads from cache (fast)
//  * - Returns null if not in cache
//  *
//  * USE CASE:
//  * - Quick checks where DB fallback is not needed
//  * - When you're sure the entry should be in cache
//  *
//  * CACHE-ONLY: This function trusts the cache and does not fall back to DB.
//  * If cache is empty (e.g., server just restarted), this returns null.
//  * Use warmActiveFeedingCache() on startup to populate cache.
//  *
//  * @param horseId - Horse to look up
//  * @returns ActiveFeeding if found in cache, null if not
//  */
// export function getActiveFeeding(horseId: string): ActiveFeeding | null {
//   return activeFeedingCache.get(horseId) ?? null;
// }
// /**
//  * Get active feeding with DB fallback (ASYNC version)
//  *
//  * WHAT IT DOES:
//  * 1. Tries to read from cache first (fast)
//  * 2. If cache miss, falls back to DB (slow but reliable)
//  * 3. If found in DB, repopulates cache (cache warming)
//  *
//  * USE CASE:
//  * - Called by handleFeederEvent (IoT event processing)
//  * - When you need guaranteed data even after cache miss
//  * - Critical operations that require 100% accuracy
//  *
//  * CACHE MISS SCENARIOS:
//  * - Server just restarted (cache empty, but should be warmed)
//  * - Entry expired from cache (30 min TTL)
//  * - Race condition: entry deleted from cache but event still processing
//  *
//  * RECOMMENDED: Use this version when processing critical IoT events
//  *
//  * @param horseId - Horse to look up
//  * @returns Promise<ActiveFeeding | null>
//  */
// export async function getActiveFeedingAsync(
//   horseId: string,
// ): Promise<ActiveFeeding | null> {
//   // STEP 1: Try cache first (fastest path)
//   const cached = activeFeedingCache.get(horseId);
//   if (cached) {
//     return cached;
//   }
//   try {
//     const dbFeeding = await prisma.activeFeeding.findUnique({
//       where: { horseId },
//       include: {
//         horse: { select: { ownerId: true } },
//       },
//     });
//     if (!dbFeeding?.horse.ownerId) {
//       return null;
//     }
//     // STEP 3: Repopulate cache (cache warming)
//     const feeding: ActiveFeeding = {
//       feedingId: dbFeeding.feedingId,
//       horseId: dbFeeding.horseId,
//       deviceId: dbFeeding.deviceId,
//       ownerId: dbFeeding.horse.ownerId,
//       status: dbFeeding.status as ActiveFeeding["status"],
//       requestedKg: dbFeeding.requestedKg,
//       startedAt: dbFeeding.startedAt!,
//     };
//     // Restore to cache for future reads
//     activeFeedingCache.set(horseId, feeding);
//     return feeding;
//   } catch (err) {
//     console.error(`❌ Failed to read from DB (${horseId}):`, err);
//     return null;
//   }
// }
// /**
//  * Update active feeding status (UPDATE operation)
//  *
//  * WHAT IT DOES:
//  * 1. Updates cache immediately (fast) or falls back to DB if cache miss
//  * 2. Updates DB asynchronously (persistence, non-blocking)
//  *
//  * USE CASE:
//  * - Called when feeding status changes (PENDING → STARTED → RUNNING)
//  * - Called from handleFeederEvent (IoT messages)
//  *
//  * PERFORMANCE:
//  * - Returns instantly after cache update
//  * - DB write happens in background
//  *
//  * DB FALLBACK: If cache miss occurs, this function will attempt to load
//  * from DB before failing. This handles edge cases like cache expiry or
//  * server restart during active feeding.
//  *
//  * @param horseId - Horse ID to update
//  * @param status - New status
//  * @param additionalData - Optional fields to update (e.g., startedAt)
//  * @returns true if updated, false if not found
//  */
// export async function updateActiveFeedingStatus(
//   horseId: string,
//   status: ActiveFeeding["status"],
//   additionalData?: Partial<ActiveFeeding>,
// ): Promise<boolean> {
//   // STEP 1: Get existing from cache
//   let existing = activeFeedingCache.get(horseId) || null;
//   if (!existing) {
//     existing = await getActiveFeedingAsync(horseId);
//     if (!existing) {
//       return false;
//     }
//   }
//   // STEP 2: Create updated object
//   const updated: ActiveFeeding = {
//     ...existing,
//     status,
//     ...additionalData, // Merge any additional fields (e.g., startedAt)
//   };
//   // STEP 3: Update cache immediately
//   activeFeedingCache.set(horseId, updated);
//   // STEP 4: Persist to DB (async, non-blocking, fire-and-forget)
//   (async () => {
//     try {
//       await prisma.activeFeeding.update({
//         where: { horseId },
//         data: {
//           status: updated.status as FeedingStatus,
//           startedAt: updated.startedAt || null,
//         },
//       });
//     } catch (err) {
//       console.error(`❌ Failed to update DB (${horseId}):`, err);
//     }
//   })();
//   return true;
// }
// /**
//  * Delete active feeding (DELETE operation)
//  *
//  * WHAT IT DOES:
//  * 1. Removes from cache immediately
//  * 2. Removes from DB (always attempts, regardless of cache state)
//  *
//  * USE CASE:
//  * - Called when feeding completes (COMPLETED or FAILED)
//  * - Frees up the horse to start a new feeding
//  *
//  * DB OPERATION: Always attempts to delete from DB, even if not in cache.
//  * This handles cases where:
//  * - Entry exists in DB but not in cache (cache miss)
//  * - Entry expired from cache but still in DB
//  * - Manual DB insertion outside of cache
//  *
//  * @param horseId - Horse ID to delete
//  * @returns true if deleted (from either cache or DB), false if not found anywhere
//  */
// export async function deleteActiveFeeding(horseId: string): Promise<boolean> {
//   // STEP 1: Delete from cache
//   const existedInCache = activeFeedingCache.delete(horseId);
//   // STEP 2: Always attempt DB delete (regardless of cache state)
//   try {
//     await prisma.activeFeeding.delete({
//       where: { horseId },
//     });
//     return true;
//   } catch (err) {
//     // If DB delete fails, return whether it existed in cache
//     // (Prisma throws if record doesn't exist)
//     if (existedInCache) {
//       console.warn(
//         `⚠️  Deleted from cache but not DB (${horseId}) - may not exist in DB`,
//       );
//     }
//     return existedInCache;
//   }
// }
// /**
//  * Get all active feedings for a specific owner
//  *
//  * WHAT IT DOES:
//  * - Scans cache for all feedings belonging to owner
//  * - Used by getHorsesStats API
//  *
//  * PERFORMANCE:
//  * - Memory scan is very fast (microseconds)
//  * - Much faster than DB query with JOIN
//  *
//  * CACHE-ONLY: This function only reads from cache and does NOT fall back to DB.
//  * This is intentional for performance reasons:
//  * - Snapshot API is polled frequently (every 5 seconds)
//  * - Speed is more important than 100% accuracy
//  * - Eventual consistency is acceptable (next IoT event will sync)
//  * - Cache is warmed on startup, so should always have data
//  *
//  * CACHE WARMING:
//  * - If cache is empty (server restart), this returns []
//  * - Call warmActiveFeedingCache() on startup to populate cache
//  * - Within seconds, IoT events will repopulate any missing entries
//  *
//  * @param ownerId - Owner/user ID to filter by
//  * @returns Array of active feedings for this owner (from cache only)
//  */
// export function getActiveFeedingsByOwner(ownerId: string): ActiveFeeding[] {
//   const feedings: ActiveFeeding[] = [];
//   // Iterate through entire cache (fast since it's in memory)
//   activeFeedingCache.forEach((feeding) => {
//     if (feeding.ownerId === ownerId) {
//       feedings.push(feeding);
//     }
//   });
//   return feedings;
// }
// /**
//  * Get ALL active feedings (for admin/debugging)
//  *
//  * CACHE-ONLY: Returns all entries currently in cache.
//  * Does not query DB.
//  *
//  * @returns Array of all active feedings in cache
//  */
// export function getAllActiveFeedings(): ActiveFeeding[] {
//   const feedings: ActiveFeeding[] = [];
//   activeFeedingCache.forEach((feeding) => {
//     feedings.push(feeding);
//   });
//   return feedings;
// }
// /**
//  * Get cache statistics (for monitoring)
//  *
//  * @returns Object with cache size and max capacity
//  */
// export function getActiveFeedingStats() {
//   return {
//     size: activeFeedingCache.size, // Current number of entries
//     max: activeFeedingCache.max, // Maximum capacity (1000)
//   };
// }
// // ============================================================================
// // CACHE WARMING - CRITICAL FOR SERVER RESTARTS
// // ============================================================================
// /**
//  * Warm cache from database on server startup
//  *
//  * WHY THIS IS CRITICAL:
//  * - When server restarts, cache is empty
//  * - Without warming, all active feedings are "lost" (not really, they're in DB)
//  * - Users would see no active feedings until next status update from ESP
//  * - This could take minutes, breaking UX
//  *
//  * WHEN TO CALL:
//  * - On server startup (before accepting requests)
//  * - After cache clear (if you implement manual cache invalidation)
//  *
//  * PERFORMANCE:
//  * - Runs once on startup (not in hot path)
//  * - Acceptable to be slow (few seconds for 1000 entries)
//  *
//  * USAGE:
//  * ```typescript
//  * // In server.ts or app.ts
//  * import { warmActiveFeedingCache } from './services/activeFeedingCache';
//  *
//  * async function startServer() {
//  *   await warmActiveFeedingCache();
//  *   app.listen(PORT);
//  * }
//  * ```
//  */
// export async function warmActiveFeedingCache(): Promise<void> {
//   console.log("🔥 Warming active feeding cache from database...");
//   try {
//     // Fetch ALL active feedings from DB
//     const activeFeedings = await prisma.activeFeeding.findMany({
//       include: {
//         horse: { select: { ownerId: true } },
//       },
//     });
//     let loaded = 0;
//     // Load each one into cache
//     for (const af of activeFeedings) {
//       // Skip if horse has no owner (data integrity issue)
//       if (!af.horse.ownerId) {
//         console.warn(`⚠️  Skipping feeding ${af.id}: horse has no owner`);
//         continue;
//       }
//       // Convert DB record to cache format
//       const feeding: ActiveFeeding = {
//         feedingId: af.feedingId,
//         horseId: af.horseId,
//         deviceId: af.deviceId,
//         ownerId: af.horse.ownerId,
//         status: af.status as ActiveFeeding["status"],
//         requestedKg: af.requestedKg,
//         startedAt: af.startedAt!,
//       };
//       // Add to cache (without writing back to DB)
//       activeFeedingCache.set(af.horseId, feeding);
//       loaded++;
//     }
//     console.log(`✅ Cache warmed: ${loaded} active feedings loaded`);
//   } catch (err) {
//     console.error("❌ Failed to warm cache from database:", err);
//     throw err; // Critical error - server shouldn't start without cache
//   }
// }
//# sourceMappingURL=activeFeedingCache.js.map