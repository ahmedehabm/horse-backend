// src/scheduler/scheduledFeeding.ts
import { DeviceType, FeederType } from "@prisma/client";
import { startScheduledFeeding } from "../services/deviceService.js";
import { prisma } from "../lib/prisma.js";

/**
 * This runs in a SEPARATE worker thread
 * Can't block the main application!
 */
async function runScheduledFeeding() {
  try {
    const now = new Date().toLocaleTimeString("en-US", {
      timeZone: "Africa/Cairo",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });

    const devices = await prisma.device.findMany({
      where: {
        deviceType: DeviceType.FEEDER,
        feederType: FeederType.SCHEDULED,
        OR: [{ morningTime: now }, { dayTime: now }, { nightTime: now }],
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

    await Promise.allSettled(
      devices.map(async (device) => {
        // Skip if no horse assigned
        if (!device.horsesAsFeeder[0]) return;

        let slot: "morning" | "day" | "night";

        if (device.morningTime === now) slot = "morning";
        else if (device.dayTime === now) slot = "day";
        else slot = "night";

        return startScheduledFeeding(device.id, slot);
      }),
    );
  } catch (err) {
    console.error("[SCHEDULED-FEED] Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

runScheduledFeeding()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
