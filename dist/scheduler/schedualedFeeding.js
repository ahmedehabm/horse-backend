// src/jobs/scheduledFeeding.ts
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
        console.log(`[SCHEDULED-FEED] [${now}] Checking for scheduled feedings...`);
        // Only query devices that match current time
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
        if (devices.length === 0) {
            console.log(`[SCHEDULED-FEED] [${now}] No devices to feed`);
            return;
        }
        console.log(`[SCHEDULED-FEED] [${now}] Found ${devices.length} devices to feed`);
        // Process all feedings in parallel
        await Promise.allSettled(devices.map(async (device) => {
            if (!device.horsesAsFeeder[0]) {
                throw new Error(`Device ${device.id} has no assigned horse`);
            }
            let slot;
            if (device.morningTime === now)
                slot = "morning";
            else if (device.dayTime === now)
                slot = "day";
            else
                slot = "night";
            return startScheduledFeeding(device.id, slot);
        }));
    }
    catch (err) {
        console.error("[SCHEDULED-FEED] Job failed:", err);
        throw err;
    }
    finally {
        await prisma.$disconnect();
    }
}
// Run the job
runScheduledFeeding()
    .then(() => {
    console.log("[SCHEDULED-FEED] Job completed successfully");
    process.exit(0);
})
    .catch((err) => {
    console.error("[SCHEDULED-FEED] Job failed:", err);
    process.exit(1);
});
//# sourceMappingURL=schedualedFeeding.js.map