import { Socket } from "socket.io";
import { Server as SocketIOServer } from "socket.io";
export declare function initializeWeightStreaming(socket: Socket, userId: string, io: SocketIOServer): Promise<void>;
export declare function handleDisconnecting(socket: Socket, userId: string, io: SocketIOServer): void;
export declare function handleLogout(socket: Socket, userId: string, io: SocketIOServer, ack?: (res: {
    ok: boolean;
    stopped?: string[];
    error?: string;
}) => void): Promise<void>;
//# sourceMappingURL=weightStreaming.d.ts.map