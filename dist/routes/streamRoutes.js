// // src/routes/streamRoutes.ts
// import express, { type Request, type Response, Router } from "express";
// import path from "path";
// import fs from "fs/promises";
// import { validateStreamToken } from "../services/streamService.js";
// import { getLatestFrame, isCameraConnected } from "../ws/cameraWs.js";
// const router: Router = express.Router();
// const PLACEHOLDER_PATH = path.resolve("./temp/placeholder.jpg");
// const STREAM_FPS = 30;
// const FRAME_INTERVAL_MS = Math.round(1000 / STREAM_FPS); // 33ms
// let placeholderBuffer: Buffer | null = null;
// (async () => {
//   try {
//     placeholderBuffer = await fs.readFile(PLACEHOLDER_PATH);
//     console.log("✅ Placeholder image loaded");
//   } catch (error) {
//     console.error("❌ Failed to load placeholder:", error);
//   }
// })();
// function createMjpegFrame(frameBytes: Buffer): Buffer {
//   return Buffer.concat([
//     Buffer.from("--frame\r\n"),
//     Buffer.from("Content-Type: image/jpeg\r\n"),
//     Buffer.from(`Content-Length: ${frameBytes.length}\r\n\r\n`),
//     frameBytes,
//     Buffer.from("\r\n"),
//   ]);
// }
// router.get("/:token", async (req: Request, res: Response) => {
//   const { token } = req.params as { token: string };
//   const streamData = await validateStreamToken(token);
//   if (!streamData) {
//     return res.status(410).json({ error: "Stream expired" });
//   }
//   console.log(`🎥 Stream opened for horse: ${streamData.horseId}`);
//   res.writeHead(200, {
//     "Content-Type": "multipart/x-mixed-replace; boundary=frame",
//     Connection: "close",
//     "Cache-Control": "no-cache, no-store, must-revalidate",
//     Pragma: "no-cache",
//     Expires: "0",
//     "X-Accel-Buffering": "no",
//   });
//   let frameCount = 0;
//   let isActive = true;
//   const streamStartTime = Date.now();
//   let lastLog = Date.now();
//   const streamLoop = () => {
//     if (!isActive || res.destroyed || res.writableEnded) return;
//     try {
//       // ✅ Always serve the latest frame — no queue, no latency
//       const frameBytes =
//         getLatestFrame(streamData.horseId!) ?? placeholderBuffer;
//       if (!frameBytes) {
//         // No frame and no placeholder yet — retry next tick
//         setTimeout(streamLoop, FRAME_INTERVAL_MS);
//         return;
//       }
//       const mjpegFrame = createMjpegFrame(frameBytes);
//       const writeSuccess = res.write(mjpegFrame);
//       frameCount++;
//       // Log every 5 seconds
//       if (Date.now() - lastLog >= 5000) {
//         const elapsed = (Date.now() - streamStartTime) / 1000;
//         const avgFps = (frameCount / elapsed).toFixed(1);
//         console.log(
//           `📊 Stream ${streamData.horseId}: ${avgFps} avg FPS | ${frameCount} total frames`,
//         );
//         lastLog = Date.now();
//       }
//       if (writeSuccess) {
//         setTimeout(streamLoop, FRAME_INTERVAL_MS);
//       } else {
//         // Backpressure — wait for TCP buffer to drain before next frame
//         res.once("drain", () => setTimeout(streamLoop, FRAME_INTERVAL_MS));
//       }
//     } catch (error) {
//       console.error("❌ Stream error:", error);
//       cleanup();
//     }
//   };
//   const cleanup = () => {
//     if (!isActive) return;
//     isActive = false;
//     if (!res.destroyed && !res.writableEnded) res.end();
//     const duration = ((Date.now() - streamStartTime) / 1000).toFixed(1);
//     console.log(`🔌 Stream closed: ${frameCount} frames in ${duration}s`);
//   };
//   req.on("close", cleanup);
//   req.on("error", cleanup);
//   streamLoop();
// });
// // Health check — shows if camera is live
// router.get("/health/:horseId", async (req: Request, res: Response) => {
//   const { horseId } = req.params as { horseId: string };
//   const hasFrame = getLatestFrame(horseId) !== null;
//   return res.json({
//     horseId,
//     status: hasFrame ? "live" : "offline",
//     hasFrame,
//   });
// });
// export default router;
import express, { Router } from "express";
import path from "path";
import fs from "fs/promises";
import { getLatestFrame } from "../ws/cameraWs.js";
import { verifyActiveStream, validateStreamToken, } from "../controllers/streamController.js";
const router = express.Router();
const PLACEHOLDER_PATH = path.resolve("./temp/placeholder.jpg");
const STREAM_FPS = 30;
const FRAME_INTERVAL_MS = Math.round(1000 / STREAM_FPS);
let placeholderBuffer = null;
(async () => {
    try {
        placeholderBuffer = await fs.readFile(PLACEHOLDER_PATH);
    }
    catch (error) {
        console.error("Failed to load placeholder:", error);
    }
})();
function createMjpegFrame(frameBytes) {
    return Buffer.concat([
        Buffer.from("--frame\r\n"),
        Buffer.from("Content-Type: image/jpeg\r\n"),
        Buffer.from(`Content-Length: ${frameBytes.length}\r\n\r\n`),
        frameBytes,
        Buffer.from("\r\n"),
    ]);
}
router.get("/:token", validateStreamToken, verifyActiveStream, async (req, res) => {
    const { horseId } = req.streamData;
    res.writeHead(200, {
        "Content-Type": "multipart/x-mixed-replace; boundary=frame",
        Connection: "close",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
        "X-Accel-Buffering": "no",
    });
    let isActive = true;
    const streamLoop = () => {
        if (!isActive || res.destroyed || res.writableEnded)
            return;
        try {
            const frameBytes = getLatestFrame(horseId) ?? placeholderBuffer;
            if (!frameBytes) {
                setTimeout(streamLoop, FRAME_INTERVAL_MS);
                return;
            }
            const mjpegFrame = createMjpegFrame(frameBytes);
            const writeSuccess = res.write(mjpegFrame);
            if (writeSuccess) {
                setTimeout(streamLoop, FRAME_INTERVAL_MS);
            }
            else {
                res.once("drain", () => setTimeout(streamLoop, FRAME_INTERVAL_MS));
            }
        }
        catch {
            cleanup();
        }
    };
    const cleanup = () => {
        if (!isActive)
            return;
        isActive = false;
        if (!res.destroyed && !res.writableEnded)
            res.end();
    };
    req.on("close", cleanup);
    req.on("error", cleanup);
    streamLoop();
});
export default router;
//# sourceMappingURL=streamRoutes.js.map