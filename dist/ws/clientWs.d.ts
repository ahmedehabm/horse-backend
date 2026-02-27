import type { Server as SocketIOServer } from "socket.io";
import type { Socket } from "socket.io";
import type { BroadcastPayload } from "../types/globalTypes.js";
export declare function punish(userId: string, socket: Socket, err: unknown): void;
export declare function setupClientWs(io: SocketIOServer): void;
export declare function broadcastStatus(payload: BroadcastPayload): Promise<void>;
export declare function emitToRoom(room: string, event: string, payload: unknown): void;
//# sourceMappingURL=clientWs.d.ts.map