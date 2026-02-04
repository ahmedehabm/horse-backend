import type { Application } from "express";
/**
 * Camera WebSocket Setup - FULLY AUTHENTICATED (New Schema)
 */
export declare function setupCameraWs(app: Application): void;
/**
 * Get active camera connections (Admin dashboard)
 */
export declare function getActiveCameras(): Array<{
    thingName: string;
    horseId: string;
    ownerId: string;
    uptime: number;
}>;
/**
 * Cleanup on shutdown
 */
export declare function cleanupCameras(): void;
//# sourceMappingURL=cameraWs.d.ts.map