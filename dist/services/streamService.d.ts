/**
 * Generate a stream token and store it PLAIN in the database
 * works for CAMERA devices only
 */
export declare function generateStreamToken(deviceId: string, tx?: any): Promise<{
    token: string;
}>;
/**
 * Validate stream token by direct comparison
 * Returns camera device ID if valid
 */
export declare function validateStreamToken(token: string): Promise<{
    id: string;
    thingName: string;
    horseId: string | undefined;
} | null>;
/**
 * Invalidate stream token
 */
export declare function invalidateStreamToken(deviceId: string, tx?: any): Promise<void>;
/**
 * Get camera details by stream token (for stream endpoints)
 */
export declare function getCameraByToken(token: string): Promise<{
    id: string;
    thingName: string;
    horseId: string | undefined;
}>;
//# sourceMappingURL=streamService.d.ts.map