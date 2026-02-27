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
    droppedFrames: number;
    ws: WebSocket;
  }
>();

function isValidJpeg(buffer: Buffer): boolean {
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
    if (!device.horsesAsCamera || device.horsesAsCamera.length === 0)
      return { authenticated: false, error: "Camera not linked to any horse" };

    return {
      authenticated: true,
      deviceId: device.id,
      horseId: device.horsesAsCamera[0]!.id,
    };
  } catch {
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
    const urlParts = req.url?.split("/");
    const thingName = urlParts?.[3]?.split("?")[0];

    if (!thingName) {
      safeSend(ws, {
        type: "ERROR",
        error: "Invalid URL. Use /ws/camera/THING_NAME",
      });
      ws.close();
      return;
    }

    safeSend(ws, { type: "CONNECTED", thingName });

    try {
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
        droppedFrames: 0,
        ws,
      };

      connectedCameras.set(thingName, cameraData);

      safeSend(ws, {
        type: "CAMERA_AUTHENTICATED",
        message: "Camera stream active",
        horseId: authResult.horseId,
        thingName,
        timestamp: Date.now(),
      });

      ws.on("message", (data: Buffer, isBinary: boolean) => {
        const camera = connectedCameras.get(thingName);
        if (!camera) return;

        if (!isBinary) return;

        if (!isValidJpeg(data)) {
          camera.droppedFrames++;
          return;
        }

        activeFrames.set(camera.horseId, data);
        camera.frameCount++;
      });

      ws.on("close", () => {
        const camera = connectedCameras.get(thingName);
        if (camera) {
          activeFrames.delete(camera.horseId);
          connectedCameras.delete(thingName);
        }
      });

      ws.on("error", () => {});
    } catch {
      ws.close();
    }
  });
}

export function getLatestFrame(horseId: string): Buffer | null {
  return activeFrames.get(horseId) || null;
}

export function isCameraConnected(thingName: string): boolean {
  return connectedCameras.has(thingName);
}

export function disconnectCamera(thingName: string): boolean {
  const camera = connectedCameras.get(thingName);
  if (camera) {
    camera.ws.close();
    return true;
  }
  return false;
}
