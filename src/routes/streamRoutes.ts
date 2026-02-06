// src/routes/streamRoutes.ts - Reads from minimal Map
import express, { type Request, type Response, Router } from "express";
import path from "path";
import sharp from "sharp";
import { validateStreamToken } from "../services/streamService.js";
import { getLatestFrame } from "../ws/cameraStreaming.js";

const router: Router = express.Router();
const PLACEHOLDER_PATH = path.resolve("./temp/placeholder.jpg");

function createMjpegFrame(frameBytes: Buffer): Buffer {
  return Buffer.concat([
    Buffer.from("--frame\r\n"),
    Buffer.from("Content-Type: image/jpeg\r\n\r\n"),
    frameBytes,
    Buffer.from("\r\n"),
  ]);
}

async function processImage(imageBuffer: Buffer | null): Promise<Buffer> {
  try {
    if (!imageBuffer) {
      return await sharp(PLACEHOLDER_PATH).jpeg({ quality: 85 }).toBuffer();
    }
    return await sharp(imageBuffer)
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
  } catch (error) {
    console.error("Invalid image:", error);

    return await sharp(PLACEHOLDER_PATH).jpeg({ quality: 85 }).toBuffer();
  }
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

  const sendFrameLoop = async () => {
    if (!isActive || res.destroyed || res.writableEnded) return;

    try {
      // Read from memory (minimal Map)
      const latestFrame = getLatestFrame(streamData.horseId!);

      const frameBytes = await processImage(latestFrame);
      const mjpegFrame = createMjpegFrame(frameBytes);

      if (res.write(mjpegFrame)) {
        frameCount++;
        if (frameCount % 100 === 0) {
          console.log(`Stream ${token}: ${frameCount} frames sent`);
        }
      } else {
        res.once("drain", sendFrameLoop);
        return;
      }
    } catch (error) {
      console.error(`Stream error ${token}:`, error);
    }

    setImmediate(sendFrameLoop);
  };

  const cleanup = () => {
    if (!isActive) return;
    isActive = false;

    if (!res.destroyed && !res.writableEnded) {
      res.end();
    }
    console.log(`Stream ${token} closed: ${frameCount} frames sent`);
  };

  req.on("close", cleanup);
  req.on("error", cleanup);

  sendFrameLoop();
});

export default router;
