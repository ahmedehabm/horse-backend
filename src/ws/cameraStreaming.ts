// src/ws/cameraWs.ts - Minimal Map with Automatic Cleanup
import type { Server as SocketIOServer, Socket } from "socket.io";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";
import { punish } from "./clientWs.js";
import AppError from "../utils/appError.js";

// Minimal in-memory storage: only active cameras
const activeFrames = new Map<string, Buffer>();

function isValidImage(buffer: Buffer): boolean {
  return (
    buffer.length > 2 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  );
}

const CameraAuthSchema = z.object({
  thingName: z.string().min(1),
});

async function authenticateCamera(
  thingName: string,
  userId: string,
): Promise<{
  authenticated: boolean;
  deviceId?: string;
  horseId?: string;
  ownerId?: string;
  error?: string;
}> {
  try {
    const device = await prisma.device.findUnique({
      where: { thingName },
      select: {
        id: true,
        deviceType: true,
        horsesAsCamera: {
          select: {
            id: true,
            ownerId: true,
            owner: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!device) {
      return { authenticated: false, error: "Camera device not found" };
    }

    if (device.deviceType !== "CAMERA") {
      return { authenticated: false, error: "Device is not a camera" };
    }

    if (!device.horsesAsCamera || device.horsesAsCamera.length === 0) {
      return { authenticated: false, error: "Camera not linked to any horse" };
    }

    const horse = device.horsesAsCamera[0];
    if (!horse!.ownerId) {
      return { authenticated: false, error: "Horse has no owner" };
    }

    if (horse!.ownerId !== userId) {
      return { authenticated: false, error: "You do not own this horse" };
    }

    return {
      authenticated: true,
      deviceId: device.id,
      horseId: horse!.id,
      ownerId: horse!.ownerId,
    };
  } catch (error) {
    console.error("Camera auth error:", error);
    return { authenticated: false, error: "Database authentication failed" };
  }
}

export function initializeCameraStreaming(
  socket: Socket,
  userId: string,
): void {
  socket.on("CAMERA_AUTH", async (message: unknown) => {
    const result = CameraAuthSchema.safeParse(message);

    if (!result.success) {
      punish(
        socket,
        new AppError("Invalid CAMERA_AUTH payload", 400),
        "CAMERA_AUTH",
      );
      return;
    }

    const { thingName } = result.data;

    if (socket.data.camera) {
      socket.emit("CAMERA_AUTH_FAILED", {
        error: "Camera already authenticated",
      });
      return;
    }

    const authResult = await authenticateCamera(thingName, userId);

    if (!authResult.authenticated) {
      console.error(`Camera auth failed: ${thingName} - ${authResult.error}`);
      socket.emit("CAMERA_AUTH_FAILED", { error: authResult.error });
      return;
    }

    socket.data.camera = {
      deviceId: authResult.deviceId!,
      horseId: authResult.horseId!,
      ownerId: authResult.ownerId!,
      thingName,
      connectedAt: Date.now(),
      frameCount: 0,
    };

    console.log(
      `Camera authenticated: ${thingName} -> Horse: ${authResult.horseId}`,
    );

    socket.emit("CAMERA_AUTHENTICATED", {
      message: "Camera stream active",
      horseId: authResult.horseId,
      thingName,
      timestamp: Date.now(),
    });
  });

  socket.on("CAMERA_FRAME", (frameBuffer: unknown) => {
    if (!socket.data.camera) {
      socket.emit("CAMERA_FRAME_ERROR", {
        error: "Camera not authenticated. Send CAMERA_AUTH first.",
      });
      return;
    }

    if (
      !Buffer.isBuffer(frameBuffer) ||
      frameBuffer.length < 5000 ||
      !isValidImage(frameBuffer)
    ) {
      console.warn(`Invalid frame from ${socket.data.camera.thingName}`);
      return;
    }

    socket.data.camera.frameCount++;

    // Store latest frame in memory (only for active cameras)
    activeFrames.set(socket.data.camera.horseId, frameBuffer);

    if (socket.data.camera.frameCount % 300 === 0) {
      console.log(
        `Camera ${socket.data.camera.thingName}: ${socket.data.camera.frameCount} frames received`,
      );
    }
  });

  // Automatic cleanup on disconnect
  const originalDisconnecting = socket.listeners("disconnecting")[0];

  socket.on("disconnecting", () => {
    if (socket.data.camera) {
      const horseId = socket.data.camera.horseId;
      const uptime = (
        (Date.now() - socket.data.camera.connectedAt) /
        1000
      ).toFixed(1);

      console.log(
        `Camera disconnected: ${socket.data.camera.thingName} (${socket.data.camera.frameCount} frames, ${uptime}s uptime)`,
      );

      // Remove frame from memory
      activeFrames.delete(horseId);
      console.log(`Cleaned up frame for horse: ${horseId}`);
    }

    // Call original handler if it exists
    if (originalDisconnecting) {
      originalDisconnecting.call(socket, "client namespace disconnect");
    }
  });
}

// Export function to get frame for HTTP streaming
export function getLatestFrame(horseId: string): Buffer | null {
  return activeFrames.get(horseId) || null;
}

// Export function to check active cameras (for monitoring)
export function getActiveCameraCount(): number {
  return activeFrames.size;
}
