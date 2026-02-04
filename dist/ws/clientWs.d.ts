import type { Server as SocketIOServer } from "socket.io";
import type { BroadcastPayload } from "../types/globalTypes.js";
/**
 * Setup SECURE Socket.IO endpoint for browser clients
 */
export declare function setupClientWs(io: SocketIOServer): void;
/**
 * Broadcast ANY payload to ALL connected clients
 */
export declare function broadcastFeedingStatus(payload: BroadcastPayload): Promise<void>;
/**
 * Send message to specific user only
 * Socket.IO handles connection checking automatically
 */
export declare function sendToUser(userId: string, payload: unknown): void;
/**
 * Get active clients list
 */
export declare function getActiveClients(): string[];
/**
 * Cleanup all clients
 */
export declare function cleanupClients(): void;
/**
 * Get connection stats
 */
export declare function getConnectionStats(): {
    totalConnections: number;
    userIds: any[];
    timestamp: string;
};
//# sourceMappingURL=clientWs.d.ts.map