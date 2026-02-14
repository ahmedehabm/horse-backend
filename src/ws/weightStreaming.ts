// src/ws/weightStreaming.ts
import { Socket } from "socket.io";
import { Server as SocketIOServer } from "socket.io";
import {
  publishWeightStreamStartMany,
  publishWeightStreamStopMany,
} from "../iot/initAwsIot.js";
import { stopStreaming } from "../services/deviceService.js";
import { prisma } from "../lib/prisma.js";

const STOP_GRACE_MS = 10000; // 10 seconds

// Helper functions
function feederRoom(thingName: string): string {
  return `feeder-weight:${thingName}`;
}

function extractThingNameFromRoom(room: string): string {
  return room.replace("feeder-weight:", "");
}

// ============================================
// SHARED STATE (one timer for all disconnects)
// ============================================

// List of feeders waiting to be stopped
let pendingWeightStops = new Set<string>();

// The single shared timer
let weightStopTimer: NodeJS.Timeout | null = null;

// List of users waiting to stop camera
let pendingCameraStops = new Set<string>();

// The single shared timer for cameras
let cameraStopTimer: NodeJS.Timeout | null = null;

// ============================================
// WHEN USER CONNECTS
// ============================================
export async function initializeWeightStreaming(
  socket: Socket,
  userId: string,
  io: SocketIOServer,
): Promise<void> {
  try {
    // Get all horses this user owns with feeders
    const rows = await prisma.horse.findMany({
      where: {
        ownerId: userId,
        feeder: { deviceType: "FEEDER" },
      },
      select: {
        feeder: { select: { thingName: true } },
      },
    });

    const thingNames = rows
      .map((r) => r.feeder?.thingName)
      .filter(Boolean) as string[];

    const toStart: string[] = [];

    for (const thingName of thingNames) {
      const room = feederRoom(thingName);

      // ✅ IMPORTANT: Remove from pending stops (user reconnected!)
      pendingWeightStops.delete(thingName);

      const sizeBefore = io.sockets.adapter.rooms.get(room)?.size ?? 0;

      // Join the room
      socket.join(room);

      // If this is the first user in this room, start streaming
      if (sizeBefore === 0) {
        toStart.push(thingName);
      }
    }

    // Tell devices to start publishing weight
    if (toStart.length) {
      await publishWeightStreamStartMany(toStart);
    }
  } catch (err) {
    console.error("❌ Weight streaming init failed", { userId, err });
  }
}

// ============================================
// WHEN USER DISCONNECTS
// ============================================
export function handleDisconnecting(
  socket: Socket,
  userId: string,
  io: SocketIOServer,
): void {
  // Skip if user explicitly logged out (already handled)
  if (socket.data.didLogout) return;

  // Find which feeders this socket was the LAST watcher for
  const toMaybeStop = getLastWatcherRooms(socket, io);

  // WEIGHT STREAMS: Schedule stop with grace period
  if (toMaybeStop.length > 0) {
    // Add all feeders to the pending list
    toMaybeStop.forEach((name) => pendingWeightStops.add(name));

    // Cancel the old timer (if exists)
    if (weightStopTimer) {
      clearTimeout(weightStopTimer);
    }

    // Start a new 10-second timer
    weightStopTimer = setTimeout(() => {
      // After 10 seconds, check which are STILL empty
      const stillEmpty: string[] = [];

      for (const thingName of pendingWeightStops) {
        const room = feederRoom(thingName);
        const size = io.sockets.adapter.rooms.get(room)?.size ?? 0;

        // If room is still empty, add to stop list
        if (size === 0) {
          stillEmpty.push(thingName);
        }
      }

      // Clear the pending list
      pendingWeightStops.clear();
      weightStopTimer = null;

      // Stop only the feeders that are still empty
      if (stillEmpty.length > 0) {
        publishWeightStreamStopMany(stillEmpty)
          .then(() => {
            console.log(`🛑 Stopped ${stillEmpty.length} weight streams`);
          })
          .catch((err) => {
            console.error("❌ Weight stream stop failed:", err);
          });
      }
    }, STOP_GRACE_MS);
  }

  // CAMERA STREAMS: Same pattern
  const userRoomSizeNow = io.sockets.adapter.rooms.get(userId)?.size ?? 0;

  if (userRoomSizeNow === 1) {
    // Add user to pending camera stops
    pendingCameraStops.add(userId);

    // Cancel old timer
    if (cameraStopTimer) {
      clearTimeout(cameraStopTimer);
    }

    // Start new timer
    cameraStopTimer = setTimeout(async () => {
      // Check which users still have no sockets
      for (const uid of pendingCameraStops) {
        const size = io.sockets.adapter.rooms.get(uid)?.size ?? 0;

        if (size === 0) {
          const user = await prisma.user.findUnique({
            where: { id: uid },
            select: { activeStreamHorseId: true },
          });

          if (user?.activeStreamHorseId) {
            await stopStreaming(user.activeStreamHorseId, uid).catch((err) => {
              console.error(`❌ Camera stop failed for ${uid}:`, err);
            });
          }
        }
      }

      // Clear pending list
      pendingCameraStops.clear();
      cameraStopTimer = null;
    }, STOP_GRACE_MS);
  }
}

// ============================================
// WHEN USER LOGS OUT (immediate stop, no grace)
// ============================================
export async function handleLogout(
  socket: Socket,
  userId: string,
  io: SocketIOServer,
  ack?: (res: { ok: boolean; stopped?: string[]; error?: string }) => void,
): Promise<void> {
  socket.data.didLogout = true;

  try {
    // Stop weight streams immediately (no grace period)
    const toStopNow = getLastWatcherRooms(socket, io);

    if (toStopNow.length) {
      await publishWeightStreamStopMany(toStopNow);
    }

    // Stop camera stream immediately
    await stopActiveUserStreamIfLastSocket(userId, io);

    ack?.({ ok: true, stopped: toStopNow });
  } catch (err: any) {
    console.error("❌ LOGOUT failed", { userId, err });
    ack?.({ ok: false, error: err?.message ?? "LOGOUT failed" });
  } finally {
    socket.disconnect(true);
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

// Find which feeder rooms this socket was the LAST watcher for
function getLastWatcherRooms(socket: Socket, io: SocketIOServer): string[] {
  const result: string[] = [];

  for (const room of socket.rooms) {
    // Only check feeder rooms
    if (!room.startsWith("feeder-weight:")) continue;

    // How many sockets are in this room right now?
    const sizeNow = io.sockets.adapter.rooms.get(room)?.size ?? 0;

    // If this socket is the only one, this feeder needs to be stopped
    if (sizeNow === 1) {
      result.push(extractThingNameFromRoom(room));
    }
  }

  return result;
}

// Stop camera if this is the last socket for this user
async function stopActiveUserStreamIfLastSocket(
  userId: string,
  io: SocketIOServer,
): Promise<void> {
  const userRoomSize = io.sockets.adapter.rooms.get(userId)?.size ?? 0;

  // Not the last socket
  if (userRoomSize !== 1) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { activeStreamHorseId: true },
  });

  if (user?.activeStreamHorseId) {
    await stopStreaming(user.activeStreamHorseId, userId);
  }
}
