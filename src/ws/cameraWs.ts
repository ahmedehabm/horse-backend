// src/ws/cameraWs.ts
import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { prisma } from "../lib/prisma.js";

const activeFrames = new Map<string, Buffer>();
const connectedCameras = new Map<
  string,
  {
    deviceId: string;
    horseId: string;
    thingName: string;
    connectedAt: number;
    frameCount: number;
    ws: WebSocket;
  }
>();

function isValidImage(buffer: Buffer): boolean {
  return (
    buffer.length > 2 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  );
}

async function authenticateCamera(thingName: string): Promise<{
  authenticated: boolean;
  deviceId?: string;
  horseId?: string;
  error?: string;
}> {
  try {
    console.log(`🔍 Looking up camera: ${thingName}`);

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

function safeSend(ws: WebSocket, data: object): boolean {
  try {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  } catch (error) {
    console.error("❌ safeSend error:", error);
    return false;
  }
}

export function setupCameraWs(wss: WebSocketServer): void {
  console.log("📹 Setting up camera WebSocket handlers");

  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    console.log("\n🔵 ========== CAMERA CONNECTION ==========");
    console.log("URL:", req.url);

    // Extract thingName from URL: /ws/camera/CAMERA_NAME
    const urlParts = req.url?.split("/");
    const thingName = urlParts?.[3]?.split("?")[0]; // Remove query params if any

    if (!thingName) {
      console.error("❌ No thingName in URL");
      safeSend(ws, {
        type: "ERROR",
        error: "Invalid URL format. Use /ws/camera/YOUR_THING_NAME",
      });
      ws.close();
      return;
    }

    console.log(`📹 Camera connecting: ${thingName}`);

    try {
      safeSend(ws, { type: "CONNECTED", thingName });

      console.log("🔐 Authenticating...");
      const authResult = await authenticateCamera(thingName);

      if (!authResult.authenticated) {
        console.error(`❌ Auth failed: ${authResult.error}`);
        safeSend(ws, { type: "CAMERA_AUTH_FAILED", error: authResult.error });
        ws.close();
        return;
      }

      const cameraData = {
        deviceId: authResult.deviceId!,
        horseId: authResult.horseId!,
        thingName,
        connectedAt: Date.now(),
        frameCount: 0,
        ws,
      };

      connectedCameras.set(thingName, cameraData);

      console.log(`✅ AUTHENTICATED`);
      console.log(`   Device: ${authResult.deviceId}`);
      console.log(`   Horse: ${authResult.horseId}`);

      safeSend(ws, {
        type: "CAMERA_AUTHENTICATED",
        message: "Camera stream active",
        horseId: authResult.horseId,
        thingName,
        timestamp: Date.now(),
      });

      console.log("✅ Waiting for frames...\n");

      // Handle frames
      ws.on("message", (data: Buffer) => {
        const camera = connectedCameras.get(thingName);
        if (!camera) return;

        // Check if it's a text message or binary frame
        if (data.length < 5000) {
          // Might be a text message
          try {
            const text = data.toString("utf8");
            console.log(`📩 Received text message: ${text.substring(0, 100)}`);
          } catch (e) {
            // Not text, might be small image - ignore
          }
          return;
        }

        // Validate frame
        if (!isValidImage(data)) {
          return;
        }

        camera.frameCount++;
        activeFrames.set(camera.horseId, data);

        if (camera.frameCount % 300 === 0) {
          console.log(`📹 ${thingName}: ${camera.frameCount} frames received`);
        }
      });

      ws.on("close", (code, reason) => {
        console.log(`\n🔴 Camera disconnected: ${thingName}`);
        console.log(`   Code: ${code}`);
        console.log(`   Reason: ${reason}`);

        const camera = connectedCameras.get(thingName);

        if (camera) {
          const uptime = ((Date.now() - camera.connectedAt) / 1000).toFixed(1);
          console.log(`   Frames: ${camera.frameCount}`);
          console.log(`   Uptime: ${uptime}s\n`);

          activeFrames.delete(camera.horseId);
          connectedCameras.delete(thingName);
        }
      });

      ws.on("error", (error) => {
        console.error(`❌ WebSocket error (${thingName}):`, error);
      });
    } catch (error) {
      console.error("❌ Handler error:", error);
      ws.close();
    }
  });
}

export function getLatestFrame(horseId: string): Buffer | null {
  return activeFrames.get(horseId) || null;
}

export function disconnectCamera(thingName: string): boolean {
  const camera = connectedCameras.get(thingName);
  if (camera) {
    camera.ws.close();
    return true;
  }
  return false;
}
