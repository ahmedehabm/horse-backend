import AppError from "../utils/appError.js";
import { protectWs } from "../controllers/authController.js";
import { startFeeding, startStreaming, stopStreaming, } from "../services/deviceService.js";
import { FeedNowSchema, StartStreamSchema } from "../lib/validators.js";
import { handleDisconnecting, handleLogout, initializeWeightStreaming, } from "./weightStreaming.js";
let ioInstance = null;
let isSetup = false;
function shouldDisconnect(err) {
    if (err instanceof AppError) {
        return [400, 401, 403, 422, 429].includes(err.statusCode);
    }
    return false;
}
export function punish(userId, socket, err) {
    const message = err instanceof AppError ? err.message : "Request rejected";
    // ✅ FIX: Send to the specific socket, not the room
    socket.emit("ERROR", { message });
    if (shouldDisconnect(err)) {
        socket.disconnect(true);
    }
}
export function setupClientWs(io) {
    if (isSetup) {
        console.warn("Socket.IO already initialized");
        return;
    }
    isSetup = true;
    ioInstance = io;
    io.use(protectWs);
    io.on("connection", async (socket) => {
        const userId = socket.data.user.id;
        socket.join(userId);
        // ✅ FIX: Add error handling
        try {
            await initializeWeightStreaming(socket, userId, io);
        }
        catch (err) {
            punish(userId, socket, err);
            return;
        }
        socket.on("FEED_NOW", async (message) => {
            const result = await FeedNowSchema.safeParseAsync(message);
            if (!result.success) {
                punish(userId, socket, new AppError("Invalid FEED_NOW payload", 400));
                return;
            }
            try {
                const msg = result.data;
                await startFeeding(msg.horseId, msg.amountKg, userId);
            }
            catch (err) {
                punish(userId, socket, err);
            }
        });
        socket.on("START_STREAM", async (message) => {
            const result = await StartStreamSchema.safeParseAsync(message);
            if (!result.success) {
                punish(userId, socket, new AppError("Invalid START_STREAM payload", 400));
                return;
            }
            try {
                const msg = result.data;
                await startStreaming(msg.horseId, userId);
            }
            catch (err) {
                punish(userId, socket, err);
            }
        });
        socket.on("STOP_STREAM", async (message) => {
            const result = await StartStreamSchema.safeParseAsync(message);
            if (!result.success) {
                punish(userId, socket, new AppError("Invalid STOP_STREAM payload", 400));
                return;
            }
            try {
                const msg = result.data;
                await stopStreaming(msg.horseId, userId);
            }
            catch (err) {
                punish(userId, socket, err);
            }
        });
        // ✅ FIX: Add error handling for LOGOUT
        socket.on("LOGOUT", async (_payload, ack) => {
            try {
                await handleLogout(socket, userId, io, ack);
            }
            catch (err) {
                if (ack) {
                    ack({ error: err instanceof Error ? err.message : "Logout failed" });
                }
                punish(userId, socket, err);
            }
        });
        socket.on("disconnecting", () => {
            handleDisconnecting(socket, userId, io);
        });
    });
}
export async function broadcastStatus(payload) {
    if (!ioInstance) {
        console.warn("Socket.IO not initialized");
        return;
    }
    try {
        const eventType = payload.type;
        ioInstance.to(payload.ownerId).emit(eventType, payload);
    }
    catch (err) {
        console.error("Broadcast failed", err);
    }
}
export function emitToRoom(room, event, payload) {
    if (!ioInstance)
        return;
    ioInstance.to(room).emit(event, payload);
}
//# sourceMappingURL=clientWs.js.map