import express, { type Request, type Response, Router } from "express";
import path from "path";
import fs from "fs/promises";
import { validateStreamToken } from "../services/streamService.js";
import {
  frameEmitter,
  getLatestFrame,
  getFrameEventName,
  getDisconnectEventName,
} from "../ws/cameraWs.js";

const router: Router = express.Router();
const PLACEHOLDER_PATH = path.resolve("./temp/placeholder.jpg");

let placeholderBuffer: Buffer | null = null;
(async () => {
  try {
    placeholderBuffer = await fs.readFile(PLACEHOLDER_PATH);
  } catch (error) {
    console.error("❌ Failed to load placeholder:", error);
  }
})();

// Prebuilt boundaries (no allocations per frame)
const FRAME_BOUNDARY = Buffer.from(
  "--frame\r\nContent-Type: image/jpeg\r\n\r\n",
);
const FRAME_END = Buffer.from("\r\n");

// Optional: cap per-stream FPS (drop extra frames if client is slow)
const MIN_SEND_INTERVAL_MS = 80; // ~12.5 fps output (tune 50-150)

function setStreamHeaders(res: Response) {
  res.writeHead(200, {
    "Content-Type": "multipart/x-mixed-replace; boundary=frame",
    Connection: "close",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    Pragma: "no-cache",
    "X-Accel-Buffering": "no",
  });

  // small latency improvement for streaming
  res.socket?.setNoDelay(true);
}

function writeMjpegFrame(res: Response, jpg: Buffer): boolean {
  if (!res.write(FRAME_BOUNDARY)) return false;
  if (!res.write(jpg)) return false;
  if (!res.write(FRAME_END)) return false;
  return true;
}

router.get("/:token", async (req: Request, res: Response) => {
  const { token } = req.params as { token: string };
  // const streamData = await validateStreamToken(token);

  const streamData = { horseId: "19b9f141-eb73-4a3b-81c3-406a94d46cfa" };

  if (!streamData) return res.status(410).json({ error: "Stream expired" });

  setStreamHeaders(res);

  const horseId = streamData.horseId!;
  let isActive = true;

  // Backpressure handling: keep only the latest pending frame
  let pendingFrame: Buffer | null = null;

  // Avoid Buffer.compare: use seq monotonic
  let lastSentSeq = 0;

  // Per-stream fps cap
  let lastWriteAt = 0;

  // Initial frame
  const initial = getLatestFrame(horseId) || placeholderBuffer;
  if (initial) writeMjpegFrame(res, initial);

  const frameEvent = getFrameEventName(horseId);
  const disconnectEvent = getDisconnectEventName(horseId);

  const tryWrite = (jpg: Buffer, seq?: number) => {
    const now = Date.now();

    // output fps throttle (prevents overheating + reduces drops/freezing)
    if (now - lastWriteAt < MIN_SEND_INTERVAL_MS) {
      pendingFrame = jpg; // keep newest
      return;
    }

    const ok = writeMjpegFrame(res, jpg);
    if (seq) lastSentSeq = seq;

    if (ok) {
      lastWriteAt = now;
    } else {
      // backpressure -> keep newest; wait for drain
      pendingFrame = jpg;
    }
  };

  const onNewFrame = (payload: {
    buffer: Buffer;
    timestamp: number;
    seq: number;
  }) => {
    if (!isActive) return;

    // drop old/duplicate without scanning buffer
    if (payload.seq <= lastSentSeq) return;

    // If currently backpressured, just replace pending with latest
    if (pendingFrame) {
      pendingFrame = payload.buffer;
      lastSentSeq = payload.seq; // move forward so we don't build backlog
      return;
    }

    tryWrite(payload.buffer, payload.seq);
  };

  const onDrain = () => {
    if (!isActive) return;
    if (!pendingFrame) return;

    const frame = pendingFrame;
    pendingFrame = null;
    tryWrite(frame);
  };

  const onCameraDisconnected = () => {
    if (!isActive) return;

    if (placeholderBuffer) {
      // show placeholder once
      writeMjpegFrame(res, placeholderBuffer);
    }
    // close soon (or keep open if you prefer)
    setTimeout(() => cleanup(), 1500);
  };

  frameEmitter.on(frameEvent, onNewFrame);
  frameEmitter.on(disconnectEvent, onCameraDisconnected);
  res.on("drain", onDrain);

  const cleanup = () => {
    if (!isActive) return;
    isActive = false;

    frameEmitter.off(frameEvent, onNewFrame);
    frameEmitter.off(disconnectEvent, onCameraDisconnected);
    res.off("drain", onDrain);

    pendingFrame = null;

    if (!res.destroyed && !res.writableEnded) res.end();
  };

  req.on("close", cleanup);
  req.on("error", cleanup);
  res.on("error", cleanup);
});

export default router;
