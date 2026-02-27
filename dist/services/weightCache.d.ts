import { LRUCache } from "lru-cache";
/**
 * In-memory cache for real-time feeder weights from IoT devices.
 * - Auto-expires entries after 1 minute of no updates
 * - Max 1000 feeders (adjust based on scale)
 * - No manual cleanup needed
 */
export declare const weightCache: LRUCache<string, number, unknown>;
export declare function setWeight(thingName: string, weight: number): void;
export declare function getWeight(thingName: string): number | null;
export declare function hasWeight(thingName: string): boolean;
//# sourceMappingURL=weightCache.d.ts.map