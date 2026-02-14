// src/scheduler/index.ts
import Bree from "bree";
import path from "path";
import { fileURLToPath } from "url";
import { broadcastStatus } from "../ws/clientWs.js";
import { publishFeedCommand } from "../iot/initAwsIot.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type BreeWorkerMsg = {
  type: "SCHEDULED_FEED_STARTED";
  payload: {
    horseId: string;
    feedingId: string;
    thingName: string;
    targetKg: number;
  };
};

/**
 * Bree scheduler - runs jobs in separate worker threads
 * Jobs can't block the main application!
 */
export const scheduler = new Bree({
  root: path.join(__dirname, "/"),

  jobs: [
    {
      name: "schedualedFeeding",
      // Run at the top of every hour (00:00, 01:00, 02:00, etc.)
      cron: "* * * * *",
      timezone: "Africa/Cairo",
    },
  ],

  workerMessageHandler: async ({ message }) => {
    const msg = message as BreeWorkerMsg | undefined;

    if (!msg) return;

    if (msg.type === "SCHEDULED_FEED_STARTED") {
      const { horseId, feedingId, thingName, targetKg } = msg.payload;

      await broadcastStatus({
        type: "FEEDING_STATUS",
        status: "PENDING",
        feedingId,
        horseId,
      });

      await publishFeedCommand(thingName, {
        type: "FEED_COMMAND",
        feedingId,
        targetKg,
        horseId,
      });
    }
  },

  // Error handling
  errorHandler: (error, workerMetadata) => {
    console.error(`[BREE] Job ${workerMetadata.name} failed:`, error);
  },
});

/**
 * Start the scheduler
 */
export function startScheduler() {
  scheduler.start();
}

/**
 * Stop the scheduler gracefully
 */
export async function stopScheduler() {
  await scheduler.stop();
}
