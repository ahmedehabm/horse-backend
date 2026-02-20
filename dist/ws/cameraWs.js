// src/ws/cameraWs.ts
import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { prisma } from "../lib/prisma.js";
// Always stores the single latest frame per horse — no queue, no latency
const activeFrames = new Map();
const connectedCameras = new Map();
function isValidJpeg(buffer) {
    return (buffer.length > 2 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff);
}
async function authenticateCamera(thingName) {
    try {
        console.log(`🔍 Authenticating camera: ${thingName}`);
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
            horseId: device.horsesAsCamera[0].id,
        };
    }
    catch (error) {
        console.error("❌ Camera auth error:", error);
        return { authenticated: false, error: "Database error" };
    }
}
function safeSend(ws, data) {
    try {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
            return true;
        }
        return false;
    }
    catch (error) {
        console.error("❌ safeSend error:", error);
        return false;
    }
}
export function setupCameraWs(wss) {
    console.log("🔹 Camera WebSocket handler ready");
    wss.on("connection", async (ws, req) => {
        console.log("\n🔵 ========== CAMERA CONNECTION ==========");
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
        console.log(`🔹 Connecting: ${thingName}`);
        safeSend(ws, { type: "CONNECTED", thingName });
        try {
            const authResult = await authenticateCamera(thingName);
            if (!authResult.authenticated) {
                console.error(`❌ Auth failed: ${authResult.error}`);
                safeSend(ws, { type: "CAMERA_AUTH_FAILED", error: authResult.error });
                ws.close();
                return;
            }
            const cameraData = {
                deviceId: authResult.deviceId,
                horseId: authResult.horseId,
                thingName,
                connectedAt: Date.now(),
                frameCount: 0,
                droppedFrames: 0,
                ws,
            };
            connectedCameras.set(thingName, cameraData);
            console.log(`✅ AUTHENTICATED | Device: ${authResult.deviceId} | Horse: ${authResult.horseId}`);
            safeSend(ws, {
                type: "CAMERA_AUTHENTICATED",
                message: "Camera stream active",
                horseId: authResult.horseId,
                thingName,
                timestamp: Date.now(),
            });
            // Rate tracking
            let lastReport = Date.now();
            let recentFrames = 0;
            // ✅ isBinary flag — no more length-based text detection hack
            ws.on("message", (data, isBinary) => {
                const camera = connectedCameras.get(thingName);
                if (!camera)
                    return;
                if (!isBinary) {
                    console.log(`📩 Text from ${thingName}: ${data.toString("utf8").slice(0, 100)}`);
                    return;
                }
                if (!isValidJpeg(data)) {
                    camera.droppedFrames++;
                    return;
                }
                // ✅ Just overwrite latest frame — zero latency, always fresh
                activeFrames.set(camera.horseId, data);
                camera.frameCount++;
                recentFrames++;
                // Log actual incoming FPS every 5 seconds
                const now = Date.now();
                if (now - lastReport >= 5000) {
                    const fps = (recentFrames / ((now - lastReport) / 1000)).toFixed(1);
                    const sizeKB = (data.length / 1024).toFixed(1);
                    console.log(`📸 ${thingName}: ${fps} FPS | ${sizeKB} KB/frame | ` +
                        `Total: ${camera.frameCount} | Dropped: ${camera.droppedFrames}`);
                    recentFrames = 0;
                    lastReport = now;
                }
            });
            ws.on("close", (code) => {
                const camera = connectedCameras.get(thingName);
                if (camera) {
                    const uptime = ((Date.now() - camera.connectedAt) / 1000).toFixed(1);
                    console.log(`\n🔴 ${thingName} disconnected | Code: ${code} | ` +
                        `Frames: ${camera.frameCount} | Dropped: ${camera.droppedFrames} | Uptime: ${uptime}s\n`);
                    activeFrames.delete(camera.horseId);
                    connectedCameras.delete(thingName);
                }
            });
            ws.on("error", (error) => {
                console.error(`❌ WS error (${thingName}):`, error);
            });
        }
        catch (error) {
            console.error("❌ Connection handler error:", error);
            ws.close();
        }
    });
}
// Latest frame — called by stream route on every tick
export function getLatestFrame(horseId) {
    return activeFrames.get(horseId) || null;
}
// Check if a camera is currently connected
export function isCameraConnected(thingName) {
    return connectedCameras.has(thingName);
}
export function disconnectCamera(thingName) {
    const camera = connectedCameras.get(thingName);
    if (camera) {
        camera.ws.close();
        return true;
    }
    return false;
}
//# sourceMappingURL=cameraWs.js.map