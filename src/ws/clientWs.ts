// src/ws/clientWs.ts - DUAL HANDLER Socket.IO (FEED + STREAM)
import type { Server as SocketIOServer } from "socket.io";
import type { Socket } from "socket.io";
import type {
  BroadcastPayload,
  FeedNowMessage,
  StartStreamMessage,
} from "../types/globalTypes.js";
import AppError from "../utils/appError.js";
import { protectWs } from "../controllers/authController.js";
import {
  startFeeding,
  startStreaming,
  stopStreaming,
} from "../services/deviceService.js";
import { FeedNowSchema, StartStreamSchema } from "../lib/validators.js";
import {
  handleDisconnecting,
  handleLogout,
  initializeWeightStreaming,
} from "./weightStreaming.js";
import { initializeCameraStreaming } from "./cameraStreaming.js";

/**
 * Store Socket.IO server instance globally for broadcasting
 */
let ioInstance: SocketIOServer | null = null;

function shouldDisconnect(err: unknown): boolean {
  if (err instanceof AppError) {
    // treat these as malicious / invalid usage
    return [400, 401, 403, 422, 429].includes(err.statusCode);
  }
  // unknown errors: your choice
  return false;
}

export function punish(socket: Socket, err: unknown, action: string) {
  const message = err instanceof AppError ? err.message : "Request rejected";

  console.error("WS violation:", {
    action,
    socketId: socket.id,
    userId: socket.data?.user?.id,
    err,
  });

  // Tell the client once (optional)
  socket.emit("ERROR", { message });

  // Drop ONLY this connection if policy says so
  if (shouldDisconnect(err)) {
    socket.disconnect(true);
  }
}

/**
 * Setup Socket.IO endpoint for browser clients
 */
export function setupClientWs(io: SocketIOServer): void {
  ioInstance = io;

  io.use(protectWs);

  io.on("connection", async (socket: Socket) => {
    const userId: string = socket.data.user.id;

    socket.join(userId);

    console.log(`Client WS connected: ${userId} socket=${socket.id}`);

    await initializeWeightStreaming(socket, userId, io);

    await initializeCameraStreaming(socket, userId);

    socket.emit("AUTH_SUCCESS", {
      userId,
      socketId: socket.id,
      timestamp: Date.now(),
    });

    socket.on("FEED_NOW", async (message: unknown) => {
      const result = await FeedNowSchema.safeParseAsync(message);
      if (!result.success) {
        punish(
          socket,
          new AppError("Invalid FEED_NOW payload", 400),
          "FEED_NOW",
        );
        return;
      }

      try {
        const msg: FeedNowMessage = result.data;
        await startFeeding(msg.horseId, msg.amountKg, userId);
      } catch (err) {
        punish(socket, err, "FEED_NOW");
      }
    });

    socket.on("START_STREAM", async (message: unknown) => {
      const result = await StartStreamSchema.safeParseAsync(message);
      if (!result.success) {
        punish(
          socket,
          new AppError("Invalid START_STREAM payload", 400),
          "START_STREAM",
        );
        return;
      }

      try {
        const msg: StartStreamMessage = result.data;
        await startStreaming(msg.horseId, userId);
      } catch (err) {
        punish(socket, err, "START_STREAM");
      }
    });
    socket.on("STOP_STREAM", async (message: unknown) => {
      //the same structure
      const result = await StartStreamSchema.safeParseAsync(message);
      if (!result.success) {
        punish(
          socket,
          new AppError("Invalid START_STREAM payload", 400),
          "START_STREAM",
        );
        return;
      }

      try {
        const msg: StartStreamMessage = result.data;
        await stopStreaming(msg.horseId, userId);
      } catch (err) {
        punish(socket, err, "START_STREAM");
      }
    });

    socket.on("LOGOUT", async (_payload, ack) => {
      await handleLogout(socket, userId, io, ack);
    });

    socket.on("disconnecting", () => {
      handleDisconnecting(socket, userId, io);
    });

    // socket.on("disconnect", (reason) => {
    //   console.log(
    //     `Client WS disconnected: ${userId} socket=${socket.id} reason=${reason}`,
    //   );
    // });
  });
}

/**
 * Broadcast payload to ALL connected clients
 */
export async function broadcastStatus(
  payload: BroadcastPayload,
): Promise<void> {
  if (!ioInstance) {
    console.warn("⚠️ Socket.IO not initialized");
    return;
  }

  try {
    switch (payload.type) {
      case "FEEDING_STATUS":
        ioInstance.emit("FEEDING_STATUS", payload);
        return;

      case "STREAM_STATUS":
        ioInstance.emit("STREAM_STATUS", payload);
        return;

      default: {
        // Unknown payload type = programmer/server bug, not client maliciousness
        console.error("❌ Unknown broadcast payload.type", payload);
        return;
      }
    }
  } catch (err) {
    // Rare: circular JSON / internal emit error
    console.error("❌ Broadcast failed", err);
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

  //  Socket.IO finds the socket by userId automatically
  ioInstance.to(userId).emit("MESSAGE", payload);
}

export function emitToRoom(
  room: string,
  event: string,
  payload: unknown,
): void {
  if (!ioInstance) return;
  ioInstance.to(room).emit(event, payload);
}

// /**
//  * Get active clients list
//  */
// export function getActiveClients(): string[] {
//   if (!ioInstance) return [];

//   //  Socket.IO provides direct access to all sockets
//   return Array.from(ioInstance.sockets.sockets.values())
//     .map((socket) => socket.data.userId)
//     .filter(Boolean) as string[];
// }

// /**
//  * Cleanup all clients
//  */
// export function cleanupClients(): void {
//   if (!ioInstance) return;

//   //  Socket.IO handles cleanup automatically
//   ioInstance.disconnectSockets();
// }

// /**
//  * Get connection stats
//  */
// export function getConnectionStats() {
//   if (!ioInstance) {
//     return {
//       totalConnections: 0,
//       userIds: [],
//       timestamp: new Date().toISOString(),
//     };
//   }

//   return {
//     totalConnections: ioInstance.sockets.sockets.size,
//     userIds: Array.from(ioInstance.sockets.sockets.values())
//       .map((socket) => socket.data.userId)
//       .filter(Boolean),
//     timestamp: new Date().toISOString(),
//   };
// }
