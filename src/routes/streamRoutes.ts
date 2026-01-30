// src/routes/streamRoutes.ts - EXACT Python Flask replica
import express, { type Request, type Response, Router } from "express";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp"; // npm i sharp
import { validateStreamToken } from "../services/streamService.js";

const router: Router = express.Router();

const TEMP_IMAGE_PATH = path.resolve("./temp/current_frame.jpg");
const PLACEHOLDER_PATH = path.resolve("./temp/placeholder.jpg");

const TEMP_DIR = path.dirname(TEMP_IMAGE_PATH)!;
import("fs").then((fsSync) => {
  if (!fsSync.existsSync(TEMP_DIR)) {
    fsSync.mkdirSync(TEMP_DIR, { recursive: true });
  }
});

interface ActiveStream {
  res: Response;
  frameCount: number;
  closed: boolean;
}

const activeStreams = new Map<string, ActiveStream>();

// MJPEG frame generator (EXACT Python replica)
function createMjpegFrame(frameBytes: Buffer): Buffer {
  return Buffer.concat([
    Buffer.from("--frame\r\n"),
    Buffer.from("Content-Type: image/jpeg\r\n\r\n"),
    frameBytes,
    Buffer.from("\r\n"),
  ]);
}

// Process image like Python PIL (validate + re-encode)
async function processImage(imagePath: string): Promise<Buffer> {
  try {
    // Sharp = PIL equivalent (validate + JPEG re-encode)
    return await sharp(imagePath)
      .jpeg({ quality: 85, mozjpeg: true }) // Fresh JPEG
      .toBuffer();
  } catch (error) {
    console.error("❌ Invalid image:", error);
    // Fallback: process placeholder exactly like Python
    return await sharp(PLACEHOLDER_PATH).jpeg({ quality: 85 }).toBuffer();
  }
}

router.get("/live/:token", async (req: Request, res: Response) => {
  const { token } = req.params as { token: string };

  // Validate token
  const feeder = await validateStreamToken(token);
  if (!feeder) {
    return res.status(410).json({ error: "Stream expired" });
  }

  if (activeStreams.has(token)) {
    return res.status(409).json({ error: "Stream active" });
  }

  // MJPEG headers (exact)
  res.writeHead(200, {
    "Content-Type": "multipart/x-mixed-replace; boundary=frame",
    Connection: "close",
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
  });

  const streamData: ActiveStream = {
    res,
    frameCount: 0,
    closed: false,
  };
  activeStreams.set(token, streamData);

  const sendFrameLoop = async () => {
    if (streamData.closed || res.destroyed || res.writableEnded) return;

    try {
      // EXACT Python logic: try main → fallback placeholder
      const frameBytes = await processImage(TEMP_IMAGE_PATH);
      const mjpegFrame = createMjpegFrame(frameBytes);

      if (res.write(mjpegFrame)) {
        streamData.frameCount++;
        if (streamData.frameCount % 100 === 0) {
          console.log(`📹 ${token}: ${streamData.frameCount} frames`);
        }
      } else {
        // Backpressure
        res.once("drain", sendFrameLoop);
        return;
      }
    } catch (error) {
      console.error(`❌ ${token}:`, error);
    }

    // Continue (Python's `continue`)
    setImmediate(sendFrameLoop);
  };

  const cleanup = () => {
    if (streamData.closed) return;
    streamData.closed = true;
    activeStreams.delete(token);

    if (!res.destroyed && !res.writableEnded) {
      res.end();
    }
    console.log(`🔌 ${token} closed: ${streamData.frameCount} frames`);
  };

  // Cleanup handlers
  req.on("close", cleanup);
  req.on("error", cleanup);

  // Start loop (Python's `while True`)
  sendFrameLoop();
});

router.get("/health", (req: Request, res: Response) => {
  res.json({ activeStreams: activeStreams.size });
});

export default router;
