// src/services/weightCache.ts
import { LRUCache } from "lru-cache";

/**
 * In-memory cache for real-time feeder weights from IoT devices.
 * - Auto-expires entries after 1 minute of no updates
 * - Max 1000 feeders (adjust based on scale)
 * - No manual cleanup needed
 */
export const weightCache = new LRUCache<string, number>({
  max: 1000,
  ttl: 1000 * 60, // 1 minute
  updateAgeOnGet: false, // Only refresh TTL on set(), not get()
  updateAgeOnHas: false,
});

// Helper functions for better DX
export function setWeight(thingName: string, weight: number): void {
  weightCache.set(thingName, weight);
}

export function getWeight(thingName: string): number | null {
  return weightCache.get(thingName) ?? null;
}

export function hasWeight(thingName: string): boolean {
  return weightCache.has(thingName);
}

// // src/services/weightCache.ts
// import { LRUCache } from "lru-cache";

// /**
//  * In-memory cache for real-time feeder weights from IoT devices.
//  * - Auto-expires entries after 1 minute of no updates
//  * - Max 1000 feeders
//  */
// export const weightCache = new LRUCache<string, number>({
//   max: 1000,
//   ttl: 1000 * 60, // 1 minute
//   updateAgeOnGet: false,
//   updateAgeOnHas: false,

//   // ✅ ADD: Log when entries are disposed (evicted/expired)
//   dispose: (value, key, reason) => {
//     console.log(`🗑️  Cache disposal: ${key} = ${value}kg (reason: ${reason})`);
//   },
// });

// // Helper functions
// export function setWeight(thingName: string, weight: number): void {
//   console.log(`💾 Cache SET: ${thingName} = ${weight}kg`);
//   weightCache.set(thingName, weight);
// }

// export function getWeight(thingName: string): number | null {
//   const weight = weightCache.get(thingName) ?? null;
//   console.log(
//     `🔍 Cache GET: ${thingName} = ${weight !== null ? weight + "kg" : "NOT FOUND"}`,
//   );
//   return weight;
// }

// export function hasWeight(thingName: string): boolean {
//   return weightCache.has(thingName);
// }

// // ✅ ADD: Get cache statistics
// export function getCacheStats() {
//   return {
//     size: weightCache.size,
//     max: weightCache.max,
//     itemCount: weightCache.size,
//   };
// }

// // ✅ ADD: List all cached things
// export function listCachedThings(): string[] {
//   const things: string[] = [];
//   weightCache.forEach((value, key) => {
//     things.push(key);
//   });
//   return things;
// }
