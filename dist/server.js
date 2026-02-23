// src/server.ts
import { config } from "dotenv";
import fs from "fs";
import http from "http";
import { parse } from "url";
config({ path: "./config.env" });
process.on("uncaughtException", (err) => {
    console.log("💥 UNCAUGHT EXCEPTION! Shutting down...");
    console.log(err.name, err.message);
    process.exit(1);
});
import app from "./app.js";
import { prisma } from "./lib/prisma.js";
import { setupCameraWs } from "./ws/cameraWs.js";
import { setupClientWs } from "./ws/clientWs.js";
import { Server as SocketIOServer } from "socket.io";
import { WebSocketServer } from "ws";
import { initAwsIot } from "./iot/initAwsIot.js";
import { handleDeviceEvent } from "./iot/deviceEventHandler.js";
import { startScheduler, stopScheduler } from "./scheduler/index.js";
const PORT = process.env.PORT || 3000;
if (!fs.existsSync("./temp")) {
    fs.mkdirSync("./temp");
}
async function connectDatabase() {
    try {
        await prisma.$connect();
        console.log("✅ Database connected successfully!");
    }
    catch (err) {
        console.error("❌ Database connection error:", err.message);
        process.exit(1);
    }
}
connectDatabase().then(() => {
    // 1. Create HTTP server
    const httpServer = http.createServer(app);
    // 2. Create Raw WebSocket Server for cameras (noServer mode)
    const wss = new WebSocketServer({
        noServer: true,
        maxPayload: 10 * 1024 * 1024,
        perMessageDeflate: false,
    });
    setupCameraWs(wss);
    // 3. Initialize Socket.IO for web clients
    const io = new SocketIOServer(httpServer, {
        path: "/socket.io",
        cors: {
            origin: process.env.CLIENT_URL || "http://localhost:5173",
            credentials: true,
        },
        pingTimeout: 60000,
        pingInterval: 25000,
        connectTimeout: 45000,
    });
    setupClientWs(io);
    // 4. Handle WebSocket upgrades - Route based on path
    httpServer.on("upgrade", (request, socket, head) => {
        const { pathname } = parse(request.url || "");
        // Route camera connections to raw WebSocket
        if (pathname?.startsWith("/ws/camera/")) {
            console.log("→ Routing to Camera WebSocket");
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit("connection", ws, request);
            });
        }
    });
    // 5. Start server
    const server = httpServer.listen(Number(PORT), "0.0.0.0", () => {
        console.log(`\n🚀 Server running on port ${PORT}`);
        // Initialize AWS IoT
        //initAwsIot(handleDeviceEvent);
        startScheduler();
    });
    //  IMPROVED: Graceful shutdown handler
    const shutdown = async (signal) => {
        console.log(`\n👋 ${signal} received. Shutting down gracefully...`);
        try {
            // 1. Stop accepting new connections
            server.close(() => {
                console.log("✅ HTTP server closed");
            });
            // 2) stop schedualing
            // await stopScheduler();
            // 3. Close WebSocket connections
            io.close(() => {
                console.log("✅ Socket.IO closed");
            });
            wss.close(() => {
                console.log("✅ Camera WebSocket closed");
            });
            // 4. Disconnect database
            await prisma.$disconnect();
            console.log("✅ Database disconnected");
            console.log("💤 Graceful shutdown complete!");
            process.exit(0);
        }
        catch (err) {
            console.error("❌ Error during shutdown:", err);
            process.exit(1);
        }
    };
    // Handle graceful shutdown
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
    // Handle unhandled rejections
    process.on("unhandledRejection", (err) => {
        console.log("💥 UNHANDLED REJECTION! Shutting down...");
        console.log(err.name, err.message);
        shutdown("UNHANDLED_REJECTION");
    });
});
//# sourceMappingURL=server.js.map