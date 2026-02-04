import type { Application } from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
export declare function initWsClient(app: Application): {
    httpServer: http.Server;
    io: SocketIOServer;
};
//# sourceMappingURL=initWsClient.d.ts.map