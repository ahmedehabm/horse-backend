// src/ws/cameraWs.ts - For ESP32 cameras (NO user auth)
import type { Server as SocketIOServer, Socket } from "socket.io";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";

// In-memory storage for active camera frames
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

async function authenticateCamera(thingName: string): Promise<{
  authenticated: boolean;
  deviceId?: string;
  horseId?: string;
  error?: string;
}> {
  try {
    const device = await prisma.device.findUnique({
      where: { thingName },
      select: {
        id: true,
        deviceType: true,
        horsesAsCamera: {
          select: { id: true },
        },
      },
    });

    if (!device) {
      return { authenticated: false, error: "Camera not found in database" };
    }

    if (device.deviceType !== "CAMERA") {
      return { authenticated: false, error: "Device is not a camera" };
    }

    if (!device.horsesAsCamera || device.horsesAsCamera.length === 0) {
      return { authenticated: false, error: "Camera not linked to any horse" };
    }

    const horse = device.horsesAsCamera[0];

    return {
      authenticated: true,
      deviceId: device.id,
      horseId: horse!.id,
    };
  } catch (error) {
    console.error("❌ Camera auth error:", error);
    return { authenticated: false, error: "Database error" };
  }
}

export function setupCameraWs(io: SocketIOServer): void {
  // CAMERA namespace "/camera" - NO protectWs middleware!
  const cameraNamespace = io.of("/camera");

  cameraNamespace.on("connection", (socket: Socket) => {
    console.log(`📹 Camera connecting: ${socket.id}`);

    socket.on("CAMERA_AUTH", async (message: unknown) => {
      const result = CameraAuthSchema.safeParse(message);

      if (!result.success) {
        console.error("❌ Invalid CAMERA_AUTH:", result.error);
        socket.emit("CAMERA_AUTH_FAILED", {
          error: "Invalid payload. Expected: {thingName: string}",
        });
        socket.disconnect();
        return;
      }

      const { thingName } = result.data;

      // if (socket.data.camera) {
      //   socket.emit("CAMERA_AUTH_FAILED", {
      //     error: "Already authenticated",
      //   });
      //   return;
      // }

      const authResult = await authenticateCamera(thingName);

      if (!authResult.authenticated) {
        console.error(
          `❌ Camera auth failed: ${thingName} - ${authResult.error}`,
        );

        socket.emit("CAMERA_AUTH_FAILED", { error: authResult.error });
        socket.disconnect();
        return;
      }

      socket.data.camera = {
        deviceId: authResult.deviceId!,
        horseId: authResult.horseId!,
        thingName,
        connectedAt: Date.now(),
        frameCount: 0,
      };

      console.log(
        `✅ Camera authenticated: ${thingName} → Horse: ${authResult.horseId}`,
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
          error: "Not authenticated. Send CAMERA_AUTH first.",
        });
        return;
      }

      if (
        !Buffer.isBuffer(frameBuffer) ||
        frameBuffer.length < 5000 ||
        !isValidImage(frameBuffer)
      ) {
        console.warn(`⚠️ Invalid frame from ${socket.data.camera.thingName}`);
        return;
      }

      socket.data.camera.frameCount++;

      // Store latest frame in memory
      activeFrames.set(socket.data.camera.horseId, frameBuffer);

      if (socket.data.camera.frameCount % 300 === 0) {
        console.log(
          `📹 ${socket.data.camera.thingName}: ${socket.data.camera.frameCount} frames`,
        );
      }
    });

    socket.on("disconnect", () => {
      if (socket.data.camera) {
        const horseId = socket.data.camera.horseId;
        const uptime = (
          (Date.now() - socket.data.camera.connectedAt) /
          1000
        ).toFixed(1);

        console.log(
          `📹 Camera disconnected: ${socket.data.camera.thingName} (${socket.data.camera.frameCount} frames, ${uptime}s)`,
        );

        // Remove frame from memory
        activeFrames.delete(horseId);
        console.log(`🗑️ Cleaned up frame for horse: ${horseId}`);
      }
    });
  });
}

// Export function to get frame for HTTP streaming
export function getLatestFrame(horseId: string): Buffer | null {
  return activeFrames.get(horseId) || null;
}

// Export function to check active cameras
export function getActiveCameraCount(): number {
  return activeFrames.size;
}
