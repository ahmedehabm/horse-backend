import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { setupClientWs } from "./clientWs.js";
export function initWsClient(app) {
    const httpServer = http.createServer(app);
    // ✅ INITIALIZE SOCKET.IO
    const io = new SocketIOServer(httpServer, {
        cors: {
            origin: process.env.CLIENT_URL || "http://localhost:5173",
            credentials: true,
        },
        // Server-side options
        pingTimeout: 60000,
        pingInterval: 25000,
        connectTimeout: 45000,
    });
    // ✅ Setup Socket.IO handlers from clientWs.ts
    setupClientWs(io);
    return { httpServer, io };
}
//# sourceMappingURL=initWsClient.js.map