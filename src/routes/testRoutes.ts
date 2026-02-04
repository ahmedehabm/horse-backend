// src/routes/testRoutes.ts
import express, {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import type { DeviceEvent, FeedEventMessage } from "../types/globalTypes.js";
import { handleDeviceEvent } from "../iot/deviceEventHandler.js";

const router: Router = express.Router();

// ✅ Test MQTT events via HTTP (simulates AWS IoT)
router.post(
  "/test/feeders/:thingName/events",
  async (req: Request, res: Response) => {
    try {
      const { thingName } = req.params as { thingName: string };
      const msg: FeedEventMessage = req.body;

      // ✅ Validate input
      if (!thingName) {
        return res.status(400).json({ error: "thingName required" });
      }

      // Simulate exact MQTT event
      const event: DeviceEvent = {
        topic: `feeders/${thingName}/events`,
        thingName,
        msg,
        timestamp: new Date(),
      };

      // ✅ Call your REAL handler (triggers database updates, etc.)
      await handleDeviceEvent(event);

      res.status(200).json({
        success: true,
        thingName,
        event,
      });
    } catch (error) {
      console.error("Test route error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default router;
