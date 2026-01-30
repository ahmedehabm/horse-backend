// src/ws/clientWs.ts - DUAL HANDLER Socket.IO (FEED + STREAM)
import type { Server as SocketIOServer } from "socket.io";
import type { Socket } from "socket.io";
import type {
  BroadcastPayload,
  ClientMessage,
  FeedNowMessage,
  StartStreamMessage,
} from "../types/globalTypes.js";
import AppError from "../utils/appError.js";

/**
 * Store Socket.IO server instance globally for broadcasting
 */
let ioInstance: SocketIOServer | null = null;

/**
 * Setup SECURE Socket.IO endpoint for browser clients
 */
export function setupClientWs(io: SocketIOServer): void {
  // ✅ Store IO instance for broadcasting
  ioInstance = io;

  // ✅ Middleware - protect middleware validates user
  // io.use((socket, next) => {
  //   const userId = (socket.request as any).user?.id;

  //   if (!userId) {
  //     next(new Error("Unauthorized"));
  //     return;
  //   }

  //   socket.data.userId = userId;
  //   next();
  // });

  // ✅ Connection handler - everything is automatic!
  io.on("connection", (socket: Socket) => {
    const userId = socket.data.userId;

    console.log(`✅ Client WS connected: ${userId}`);

    // ✅ Send auth success
    socket.emit("AUTH_SUCCESS", {
      userId,
      socketId: socket.id,
      timestamp: Date.now(),
    });

    // ✅ Listen for FEED_NOW
    socket.on("FEED_NOW", async (msg: FeedNowMessage) => {
      await handleFeedNow(socket, userId, msg);
    });

    // ✅ Listen for START_STREAM
    socket.on("START_STREAM", async (msg: StartStreamMessage) => {
      await handleStartStream(socket, userId, msg);
    });

    // ✅ Ping/Pong for keep-alive
    socket.on("ping", () => {
      socket.emit("pong");
    });

    // ✅ Automatic disconnect handling - no cleanup needed!
    socket.on("disconnect", () => {
      console.log(`❌ Client WS disconnected: ${userId}`);
    });
  });
}

/**
 * Broadcast ANY payload to ALL connected clients
 */
export function broadcastFeedingStatus(payload: BroadcastPayload): void {
  if (!ioInstance) {
    console.warn("⚠️  Socket.IO not initialized");
    return;
  }

  if (payload.type === "FEEDING_STATUS") {
    ioInstance.emit("FEEDING_STATUS", payload);
  } else if (payload.type === "STREAM_STATUS") {
    ioInstance.emit("STREAM_STATUS", payload);
  }
}

/**
 * Send message to specific user only
 * Socket.IO handles connection checking automatically
 */
export function sendToUser(userId: string, payload: unknown): void {
  if (!ioInstance) {
    console.warn("⚠️  Socket.IO not initialized");
    return;
  }

  // ✅ Socket.IO finds the socket by userId automatically
  ioInstance.to(userId).emit("MESSAGE", payload);
}

/**
 * HANDLE FEED_NOW - Send FEED_COMMAND to feeder
 */
async function handleFeedNow(
  socket: Socket,
  userId: string,
  msg: FeedNowMessage,
): Promise<void> {
  const { horseId, amountKg } = msg;

  console.log(
    `👤 [${userId}] FEED_NOW: horse=${horseId}, amount=${amountKg}kg`,
  );

  try {
    const { startFeeding } = await import("../services/deviceService.js");
    const result = await startFeeding(horseId, amountKg);

    // socket.emit("FEEDING_STATUS", {
    //   type: "FEEDING_STATUS",
    //   status: "ACCEPTED",
    //   feedingId: result.feeding.id,
    //   horseId,
    //   deviceName: result.device.thingName,
    // } satisfies BroadcastPayload);

    broadcastFeedingStatus({
      type: "FEEDING_STATUS",
      status: "ACCEPTED",
      feedingId: result.feeding.id,
      horseId,
      deviceName: result.device.thingName,
    });
  } catch (err) {
    socket.emit("ERROR", {
      message: err instanceof AppError ? err.message : "Feeding failed",
    });
  }
}

/**
 * HANDLE START_STREAM - Send STREAM_COMMAND to camera
 */
async function handleStartStream(
  socket: Socket,
  userId: string,
  msg: StartStreamMessage,
): Promise<void> {
  const { horseId } = msg;

  console.log(`👤 [${userId}] START_STREAM: horse=${horseId}`);

  try {
    const { startStreaming } = await import("../services/deviceService.js");
    const result = await startStreaming(horseId);

    socket.emit("STREAM_STATUS", {
      type: "STREAM_STATUS",
      status: "ACCEPTED",
      horseId,
      deviceName: result.device.thingName,
      streamUrl: "WORKING ON...",
    } satisfies BroadcastPayload);
  } catch (err) {
    socket.emit("ERROR", {
      message: err instanceof AppError ? err.message : "Stream failed",
    });
  }
}

/**
 * Get active clients list
 */
export function getActiveClients(): string[] {
  if (!ioInstance) return [];

  // ✅ Socket.IO provides direct access to all sockets
  return Array.from(ioInstance.sockets.sockets.values())
    .map((socket) => socket.data.userId)
    .filter(Boolean) as string[];
}

/**
 * Cleanup all clients
 */
export function cleanupClients(): void {
  if (!ioInstance) return;

  // ✅ Socket.IO handles cleanup automatically
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
