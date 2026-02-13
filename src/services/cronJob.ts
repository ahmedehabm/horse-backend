import cron from "node-cron";
import { prisma } from "../app.js";
import { DeviceType, FeederType } from "@prisma/client";
import { startScheduledFeeding } from "./deviceService.js";

cron.schedule(
  "* * * * *",
  async () => {
    // Every min (or '*/2' for 2min)
    try {
      const now = new Date().toLocaleTimeString("en-US", {
        timeZone: "Africa/Cairo",
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      }); // "05:00" in Egypt time

      const devices = await prisma.device.findMany({
        where: {
          deviceType: DeviceType.FEEDER,
          feederType: FeederType.SCHEDULED,
        },
        select: {
          id: true,
          morningTime: true,
          dayTime: true,
          nightTime: true,
          horsesAsFeeder: {
            select: { id: true },
            take: 1,
          },
        },
      });

      // Async loop w/ error isolation (one fail ≠ all fail)
      await Promise.allSettled(
        devices.map(async (d) => {
          if (!d.horsesAsFeeder[0]) return;

          if (d.morningTime === now) {
            await startScheduledFeeding(d.id, "morning");
          }
          if (d.dayTime === now) {
            await startScheduledFeeding(d.id, "day");
          }
          if (d.nightTime === now) {
            await startScheduledFeeding(d.id, "night");
          }
        }),
      );
    } catch (err) {
      console.error("Cron feed check failed:", err);
      // Optional: Slack/email alert
    }
  },
  {
    timezone: "Africa/Cairo", // Egypt timezone
  },
);
