// src/ws/cameraWs.ts - AUTHENTICATED Camera WebSocket (NEW SCHEMA)
import fs from "fs/promises";
import path from "path";
import type { Application, Request } from "express";
import type WebSocket from "ws";
import { prisma } from "../lib/prisma.js";

const TEMP_IMAGE_PATH = path.resolve("./temp/current_frame.jpg");

// ✅ NEW: Cache by thingName → { deviceId, horseId, ownerId }
const authenticatedCameras = new Map<
  string,
  {
    deviceId: string;
    horseId: string;
    ownerId: string;
    thingName: string;
    connectedAt: Date;
  }
>();

/**
 * Validate JPEG magic bytes (0xFFD8FF)
 */
function isValidImage(buffer: Buffer): boolean {
  return (
    buffer.length > 2 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  );
}

/**
 * ONE-TIME Authentication: Check CAMERA device → Horse → Owner
 */
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
    // ✅ 1. Find CAMERA device by thingName
    const device = await prisma.device.findUnique({
      where: { thingName },
      select: {
        id: true,
        deviceType: true,
        // ✅ 2. Get horse via camera relation (Horse.cameraId → Device.id)
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
      return {
        authenticated: false,
        error: "Camera device not found",
      };
    }

    // ✅ 3. Verify it's a CAMERA device
    if (device.deviceType !== "CAMERA") {
      return {
        authenticated: false,
        error: "Device is not a camera",
      };
    }

    // ✅ 4. Verify linked to exactly 1 horse
    if (!device.horsesAsCamera || device.horsesAsCamera.length === 0) {
      return {
        authenticated: false,
        error: "Camera not linked to any horse",
      };
    }

    const horse = device.horsesAsCamera[0]; // 1:1 relationship
    if (!horse!.ownerId) {
      return {
        authenticated: false,
        error: "Horse has no owner",
      };
    }

    // ✅ 5. Ownership check
    if (horse!.ownerId !== userId) {
      return {
        authenticated: false,
        error: "You do not own this horse",
      };
    }

    return {
      authenticated: true,
      deviceId: device.id,
      horseId: horse!.id,
      ownerId: horse!.ownerId,
    };
  } catch (error) {
    console.error("❌ Camera auth error:", error);
    return {
      authenticated: false,
      error: "Database authentication failed",
    };
  }
}

/**
 * Camera WebSocket Setup - FULLY AUTHENTICATED (New Schema)
 */
export function setupCameraWs(app: Application): void {
  app.ws("/ws/camera/:thingName", async (ws: WebSocket, req: Request) => {
    // ✅ protect middleware already ran → req.user exists
    if (!req.user || !req.user.id) {
      ws.send(
        JSON.stringify({
          type: "AUTH_FAILED",
          error: "No user logged in",
        }),
      );
      ws.close(4401, "No user logged in");
      return;
    }

    const { thingName } = req.params as { thingName: string };

    // ✅ ONE-TIME AUTHENTICATION (at connection only)
    console.log(`📹 Camera connecting: ${thingName}`);

    const authResult = await authenticateCamera(thingName, req.user.id);

    if (!authResult.authenticated) {
      console.error(
        `❌ Camera auth failed: ${thingName} - ${authResult.error}`,
      );
      ws.send(
        JSON.stringify({
          type: "AUTH_FAILED",
          error: authResult.error,
        }),
      );
      ws.close(4401, authResult.error);
      return;
    }

    // ✅ CACHE authenticated camera (no more DB checks per frame!)
    authenticatedCameras.set(thingName, {
      deviceId: authResult.deviceId!,
      horseId: authResult.horseId!,
      ownerId: authResult.ownerId!,
      thingName,
      connectedAt: new Date(),
    });

    console.log(
      `✅ Camera authenticated: ${thingName} → Horse: ${authResult.horseId}`,
    );

    // Send success to ESP32 camera
    ws.send(
      JSON.stringify({
        type: "AUTHENTICATED",
        message: "Camera stream active",
        timestamp: Date.now(),
      }),
    );

    // ✅ FRAME RECEIVER (SECURE - uses cache only)
    let frameCount = 0;
    ws.on("message", async (message: WebSocket.RawData) => {
      // Only process binary JPEG frames
      if (
        Buffer.isBuffer(message) &&
        message.length > 5000 &&
        isValidImage(message)
      ) {
        try {
          await fs.writeFile(TEMP_IMAGE_PATH, message);
          frameCount++;

          if (frameCount % 300 === 0) {
            console.log(
              `📸 Camera ${thingName}: ${frameCount} frames received`,
            );
          }
        } catch (error) {
          console.error(`❌ Frame write error [${thingName}]:`, error);
        }
      }
    });

    // ✅ DISCONNECT
    ws.on("close", (code: number, reason: string) => {
      authenticatedCameras.delete(thingName);
      console.log(
        `📹 Camera disconnected: ${thingName} (${frameCount} frames total)`,
      );
    });

    // ✅ ERROR
    ws.on("error", (error: Error) => {
      console.error(`❌ Camera WS error [${thingName}]:`, error.message);
      authenticatedCameras.delete(thingName);
    });
  });
}

/**
 * Get active camera connections (Admin dashboard)
 */
export function getActiveCameras(): Array<{
  thingName: string;
  horseId: string;
  ownerId: string;
  uptime: number;
}> {
  return Array.from(authenticatedCameras.entries()).map(
    ([thingName, data]) => ({
      thingName,
      horseId: data.horseId,
      ownerId: data.ownerId,
      uptime: Date.now() - data.connectedAt.getTime(),
    }),
  );
}

/**
 * Cleanup on shutdown
 */
export function cleanupCameras(): void {
  authenticatedCameras.clear();
}
