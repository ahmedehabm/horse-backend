import AppError from "../utils/appError.js";
import { protectWs } from "../controllers/authController.js";
import { startFeeding, startStreaming } from "../services/deviceService.js";
/**
 * Store Socket.IO server instance globally for broadcasting
 */
let ioInstance = null;
/**
 * Setup SECURE Socket.IO endpoint for browser clients
 */
export function setupClientWs(io) {
    //  Store IO instance for broadcasting
    ioInstance = io;
    //  Middleware - protect middleware validates user
    io.use(protectWs);
    //  Connection handler - everything is automatic!
    io.on("connection", (socket) => {
        const userId = socket.data.user.id;
        console.log(` Client WS connected: ${userId}`);
        //  Send auth success
        socket.emit("AUTH_SUCCESS", {
            userId,
            socketId: socket.id,
            timestamp: Date.now(),
        });
        //  Listen for FEED_NOW
        socket.on("FEED_NOW", async (msg) => {
            await handleFeedNow(socket, userId, msg);
        });
        //  Listen for START_STREAM
        socket.on("START_STREAM", async (msg) => {
            await handleStartStream(socket, userId, msg);
        });
        //  Ping/Pong for keep-alive
        socket.on("ping", () => {
            socket.emit("pong");
        });
        //  Automatic disconnect handling - no cleanup needed!
        socket.on("disconnect", () => {
            console.log(`❌ Client WS disconnected: ${userId}`);
        });
    });
}
/**
 * Broadcast ANY payload to ALL connected clients
 */
export async function broadcastFeedingStatus(payload) {
    if (!ioInstance) {
        console.warn("⚠️  Socket.IO not initialized");
        return;
    }
    if (payload.type === "FEEDING_STATUS") {
        ioInstance.emit("FEEDING_STATUS", payload);
    }
    else if (payload.type === "STREAM_STATUS") {
        ioInstance.emit("STREAM_STATUS", payload);
    }
}
/**
 * Send message to specific user only
 * Socket.IO handles connection checking automatically
 */
export function sendToUser(userId, payload) {
    if (!ioInstance) {
        console.warn("⚠️  Socket.IO not initialized");
        return;
    }
    //  Socket.IO finds the socket by userId automatically
    ioInstance.to(userId).emit("MESSAGE", payload);
}
/**
 * HANDLE FEED_NOW - Send FEED_COMMAND to feeder
 */
async function handleFeedNow(socket, userId, msg) {
    const { horseId, amountKg } = msg;
    console.log(`👤 [${userId}] FEED_NOW: horse=${horseId}, amount=${amountKg}kg`);
    try {
        await startFeeding(horseId, amountKg, userId);
    }
    catch (err) {
        socket.emit("ERROR", {
            message: err instanceof AppError ? err.message : "Feeding failed",
        });
    }
}
/**
 * HANDLE START_STREAM - Send STREAM_COMMAND to camera
 */
async function handleStartStream(socket, userId, msg) {
    const { horseId } = msg;
    console.log(`👤 [${userId}] START_STREAM: horse=${horseId}`);
    try {
        await startStreaming(horseId, userId);
    }
    catch (err) {
        socket.emit("ERROR", {
            message: err instanceof AppError ? err.message : "Stream failed",
        });
    }
}
/**
 * Get active clients list
 */
export function getActiveClients() {
    if (!ioInstance)
        return [];
    //  Socket.IO provides direct access to all sockets
    return Array.from(ioInstance.sockets.sockets.values())
        .map((socket) => socket.data.userId)
        .filter(Boolean);
}
/**
 * Cleanup all clients
 */
export function cleanupClients() {
    if (!ioInstance)
        return;
    //  Socket.IO handles cleanup automatically
    ioInstance.disconnectSockets();
}
/**
 * Get connection stats
 */
export function getConnectionStats() {
    if (!ioInstance) {
        return {
            totalConnections: 0,
            userIds: [],
            timestamp: new Date().toISOString(),
        };
    }
    return {
        totalConnections: ioInstance.sockets.sockets.size,
        userIds: Array.from(ioInstance.sockets.sockets.values())
            .map((socket) => socket.data.userId)
            .filter(Boolean),
        timestamp: new Date().toISOString(),
    };
}
//# sourceMappingURL=clientWs.js.map