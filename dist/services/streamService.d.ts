/**
 * Generate a stream token and store its hash in the database
 * ✅ Now works for CAMERA devices only
 */
export declare function generateStreamToken(deviceId: string): Promise<{
    token: string;
}>;
/**
 * Validate stream token by hashing and comparing
 * ✅ Returns camera device ID if valid
 */
export declare function validateStreamToken(token: string): Promise<{
    id: string;
    thingName: string;
} | null>;
/**
 * Invalidate stream token
 */
export declare function invalidateStreamToken(deviceId: string): Promise<void>;
/**
 * Get camera details by stream token (for stream endpoints)
 */
export declare function getCameraByToken(token: string): Promise<{
    id: string;
    thingName: string;
}>;
//# sourceMappingURL=streamService.d.ts.map