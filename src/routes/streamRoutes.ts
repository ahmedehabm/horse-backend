// src/routes/streamRoutes.ts - Optimized streaming
import express, { type Request, type Response, Router } from "express";
import path from "path";
import fs from "fs/promises";
import { validateStreamToken } from "../services/streamService.js";
import { getLatestFrame } from "../ws/cameraWs.js";
// import { getLatestFrame } from "../ws/cameraStreaming.js";

const router: Router = express.Router();
const PLACEHOLDER_PATH = path.resolve("./temp/placeholder.jpg");

//  Pre-load placeholder once at startup
let placeholderBuffer: Buffer | null = null;

(async () => {
  try {
    placeholderBuffer = await fs.readFile(PLACEHOLDER_PATH);
  } catch (error) {
    console.error("❌ Failed to load placeholder:", error);
  }
})();

function createMjpegFrame(frameBytes: Buffer): Buffer {
  return Buffer.concat([
    Buffer.from("--frame\r\n"),
    Buffer.from("Content-Type: image/jpeg\r\n\r\n"),
    frameBytes,
    Buffer.from("\r\n"),
  ]);
}

router.get("/:token", async (req: Request, res: Response) => {
  const { token } = req.params as { token: string };
  const streamData = await validateStreamToken(token);
  if (!streamData) {
    return res.status(410).json({ error: "Stream expired" });
  }

  res.writeHead(200, {
    "Content-Type": "multipart/x-mixed-replace; boundary=frame",
    Connection: "close",
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
  });

  let frameCount = 0;
  let isActive = true;

  // ✅ Use setInterval instead of setImmediate
  const intervalId = setInterval(() => {
    if (!isActive || res.destroyed || res.writableEnded) {
      clearInterval(intervalId);
      return;
    }

    try {
      // Get latest frame from memory (already JPEG from ESP32)
      const latestFrame = getLatestFrame(streamData.horseId!);

      //  Use frame directly (no Sharp re-encoding!)
      const frameBytes = latestFrame || placeholderBuffer;

      if (!frameBytes) {
        // No frame available, skip this iteration
        return;
      }

      const mjpegFrame = createMjpegFrame(frameBytes);

      if (res.write(mjpegFrame)) {
        frameCount++;
        if (frameCount % 100 === 0) {
          console.log(`📹 Stream: ${frameCount} frames sent`);
        }
      } else {
        // Backpressure - pause interval temporarily
        res.once("drain", () => {
          // Resume on next interval tick
        });
      }
    } catch (error) {
      console.error("❌ Stream error:", error);
    }
  }, 33); //  33ms = ~30 FPS

  const cleanup = () => {
    if (!isActive) return;
    isActive = false;

    clearInterval(intervalId); //  Stop the interval

    if (!res.destroyed && !res.writableEnded) {
      res.end();
    }
    console.log(`🔌 Stream closed: ${frameCount} frames sent`);
  };

  req.on("close", cleanup);
  req.on("error", cleanup);
});

export default router;
