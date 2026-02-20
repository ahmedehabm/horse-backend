import type { Server as SocketIOServer } from "socket.io";
import type { Socket } from "socket.io";
import type { BroadcastPayload } from "../types/globalTypes.js";
export declare function punish(socket: Socket, err: unknown, action: string): void;
/**
 * Setup Socket.IO endpoint for browser clients
 */
export declare function setupClientWs(io: SocketIOServer): void;
/**
 * Broadcast payload to ALL connected clients
 */
export declare function broadcastStatus(payload: BroadcastPayload): Promise<void>;
/**
 * Send message to specific user only
 * Socket.IO handles connection checking automatically
 */
export declare function sendToUser(userId: string, payload: unknown): void;
export declare function emitToRoom(room: string, event: string, payload: unknown): void;
//# sourceMappingURL=clientWs.d.ts.map