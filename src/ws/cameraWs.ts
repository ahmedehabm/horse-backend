import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { prisma } from "../lib/prisma.js";
import { EventEmitter } from "events";

export const frameEmitter = new EventEmitter();
frameEmitter.setMaxListeners(30);

// Throttle how often we WAKE UP streams (not how often we store frames)
const MIN_EMIT_INTERVAL_MS = 80; // ~12.5 fps notify rate (tune 50-150)

type LatestFrame = {
  buffer: Buffer;
  timestamp: number;
  seq: number;
};

const latestFrames = new Map<string, LatestFrame>();

const connectedCameras = new Map<
  string,
  {
    deviceId: string;
    horseId: string;
    thingName: string;
    connectedAt: number;
    frameCount: number;
    seq: number;
    lastEmittedAt: number;
    ws: WebSocket;
  }
>();

function frameEventName(horseId: string) {
  return `frame:${horseId}`;
}
function disconnectEventName(horseId: string) {
  return `cameraDisconnected:${horseId}`;
}
export function getFrameEventName(horseId: string) {
  return frameEventName(horseId);
}
export function getDisconnectEventName(horseId: string) {
  return disconnectEventName(horseId);
}

function isValidImage(buffer: Buffer): boolean {
  // Cheap-ish JPEG check: SOI + EOI
  return (
    buffer.length > 100 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff &&
    buffer[buffer.length - 2] === 0xff &&
    buffer[buffer.length - 1] === 0xd9
  );
}

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
        horsesAsCamera: { select: { id: true } },
      },
    });

    if (!device)
      return { authenticated: false, error: "Camera not found in database" };
    if (device.deviceType !== "CAMERA")
      return { authenticated: false, error: "Device is not a camera" };
    if (!device.horsesAsCamera?.length)
      return { authenticated: false, error: "Camera not linked to any horse" };

    return {
      authenticated: true,
      deviceId: device.id,
      horseId: device.horsesAsCamera[0]!.id,
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
  } catch {
    return false;
  }
}

export function setupCameraWs(wss: WebSocketServer): void {
  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    const urlParts = req.url?.split("/").filter(Boolean);
    const thingName = urlParts?.[urlParts.length - 1]?.split("?")[0];

    if (!thingName) {
      safeSend(ws, { type: "ERROR", error: "Use /ws/camera/YOUR_THING_NAME" });
      ws.close();
      return;
    }

    safeSend(ws, { type: "CONNECTED", thingName });

    const authResult = await authenticateCamera(thingName);
    if (!authResult.authenticated) {
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
      seq: 0,
      lastEmittedAt: 0,
      ws,
    };

    connectedCameras.set(thingName, cameraData);

    safeSend(ws, {
      type: "CAMERA_AUTHENTICATED",
      horseId: cameraData.horseId,
      thingName,
      timestamp: Date.now(),
    });

    ws.on("message", (data: Buffer) => {
      const camera = connectedCameras.get(thingName);
      if (!camera) return;

      if (data.length < 5000) return; // ignore small chatter
      if (!isValidImage(data)) return;

      camera.frameCount++;
      camera.seq++;

      const now = Date.now();
      const payload: LatestFrame = {
        buffer: data,
        timestamp: now,
        seq: camera.seq,
      };

      // Always store latest (cheap)
      latestFrames.set(camera.horseId, payload);

      // Emit at a controlled rate (big CPU win)
      if (now - camera.lastEmittedAt >= MIN_EMIT_INTERVAL_MS) {
        camera.lastEmittedAt = now;
        frameEmitter.emit(frameEventName(camera.horseId), payload);
      }
    });

    ws.on("close", () => {
      const camera = connectedCameras.get(thingName);
      if (!camera) return;

      frameEmitter.emit(disconnectEventName(camera.horseId));
      latestFrames.delete(camera.horseId);
      connectedCameras.delete(thingName);
    });
  });
}

export function getLatestFrame(horseId: string): Buffer | null {
  return latestFrames.get(horseId)?.buffer ?? null;
}
export function getLatestFrameMeta(horseId: string): LatestFrame | null {
  return latestFrames.get(horseId) ?? null;
}
