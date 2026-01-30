// src/iot/deviceEventHandler.ts
import { prisma } from "../lib/prisma.js";
import { FeedingStatus } from "@prisma/client";
import { broadcastFeedingStatus } from "../ws/clientWs.js";
import type {
  DeviceEvent,
  FeedEventMessage,
  CameraEventMessage,
} from "../types/globalTypes.js";
import AppError from "../utils/appError.js";
import {
  generateStreamToken,
  invalidateStreamToken,
} from "../services/streamService.js";

/**
 * BIG ROUTER FUNCTION - Routes FEEDER vs CAMERA events
 */
export async function handleDeviceEvent(event: DeviceEvent): Promise<void> {
  const { msg, thingName, topic } = event;

  console.log(`📡 Device [${thingName}]: ${msg.type} → ${topic}`);

  // ✅ Route by device type (topic prefix)
  if (topic.startsWith("feeders/")) {
    await handleFeederEvent(event as DeviceEvent & { msg: FeedEventMessage });
  } else if (topic.startsWith("cameras/")) {
    await handleCameraEvent(event as DeviceEvent & { msg: CameraEventMessage });
  } else {
    console.warn(`⚠️ Unknown device type: ${topic}`);
  }
}

/**
 * LOCAL HELPER: Handle FEEDER events ONLY (NO stream token logic!)
 */
async function handleFeederEvent(
  event: DeviceEvent & { msg: FeedEventMessage },
): Promise<void> {
  const { msg, thingName } = event;

  console.log(`🐴 FEEDER [${thingName}]: ${msg.type}`);

  switch (msg.type) {
    case "FEEDING_STARTED": {
      const feeding = await prisma.feeding.update({
        where: { id: msg.feedingId },
        data: {
          status: FeedingStatus.RUNNING,
          startedAt: new Date(),
        },
        include: {
          horse: {
            include: { feeder: true },
          },
          device: true,
        },
      });

      if (!feeding.horse || !feeding.horse.feeder) {
        console.error(`❌ Feeder not found for feeding: ${msg.feedingId}`);
        return;
      }

      // ✅ NO STREAM LOGIC HERE - Just notify feeding started
      broadcastFeedingStatus({
        type: "FEEDING_STATUS",
        horseId: feeding.horseId,
        feedingId: feeding.id,
        status: "STARTED",
        deviceName: feeding.horse.feeder.thingName,
      });
      break;
    }

    case "FEEDING_PROGRESS": {
      const feeding = await prisma.feeding.findUnique({
        where: { id: msg.feedingId },
        include: {
          horse: {
            include: { feeder: true },
          },
        },
      });

      if (!feeding?.horse?.feeder) return;

      broadcastFeedingStatus({
        type: "FEEDING_STATUS",
        horseId: feeding.horseId,
        feedingId: feeding.id,
        status: "RUNNING",
        deviceName: feeding.horse.feeder.thingName,
      });
      break;
    }

    case "FEEDING_COMPLETED": {
      const now = new Date();
      const feeding = await prisma.feeding.update({
        where: { id: msg.feedingId },
        data: {
          status: FeedingStatus.COMPLETED,
          completedAt: now,
        },
        include: {
          horse: {
            include: { feeder: true },
          },
        },
      });

      // Update horse lastFeedAt
      await prisma.horse.update({
        where: { id: feeding.horseId },
        data: { lastFeedAt: now },
      });

      // ✅ NO STREAM TOKEN LOGIC - Pure feeding completion
      broadcastFeedingStatus({
        type: "FEEDING_STATUS",
        horseId: feeding.horseId,
        feedingId: feeding.id,
        status: "COMPLETED",
        deviceName: feeding.horse.feeder?.thingName!,
      });
      break;
    }

    case "FEEDING_ERROR": {
      const feeding = await prisma.feeding.update({
        where: { id: msg.feedingId },
        data: { status: FeedingStatus.FAILED },
        include: {
          horse: {
            include: { feeder: true },
          },
        },
      });

      // ✅ NO STREAM TOKEN LOGIC - Pure feeding error
      broadcastFeedingStatus({
        type: "FEEDING_STATUS",
        horseId: feeding.horseId,
        feedingId: feeding.id,
        status: "FAILED",
        errorMessage: msg.errorMessage!,
      });
      break;
    }
  }
}

/**
 *
 *
 * LOCAL HELPER: Handle CAMERA events ONLY (ALL stream token logic here!)
 *
 *
 *
 */
async function handleCameraEvent(
  event: DeviceEvent & { msg: CameraEventMessage },
): Promise<void> {
  const { msg, thingName } = event;

  console.log(`📹 CAMERA [${thingName}]: ${msg.type}`);

  // ✅ Find camera device + linked horse
  const device = await prisma.device.findUnique({
    where: { thingName },
    include: {
      horsesAsCamera: {
        include: {
          owner: { select: { id: true } },
        },
      },
    },
  });

  const horse = device?.horsesAsCamera[0];

  if (!device || device.deviceType !== "CAMERA" || !horse)
    throw new AppError("Not a valid cam", 404);

  switch (msg.type) {
    case "STREAM_STARTED": {
      if (horse) {
        const { token } = await generateStreamToken(device.id);

        broadcastFeedingStatus({
          type: "STREAM_STATUS",
          horseId: horse.id,
          status: "STARTED",
          streamUrl: `/stream/${token}`,
          deviceName: thingName,
        });
      }
      break;
    }

    case "STREAM_STOPPED": {
      await invalidateStreamToken(device.id);

      broadcastFeedingStatus({
        type: "STREAM_STATUS",
        horseId: horse.id,
        status: "ENDED",
        streamUrl: "ENDED",
        deviceName: thingName,
      });
      break;
    }

    case "STREAM_ERROR": {
      await invalidateStreamToken(device.id);

      if (horse) {
        broadcastFeedingStatus({
          type: "STREAM_STATUS",
          horseId: horse.id,
          status: "ERROR",
          streamUrl: "ENDED",
          errorMessage: msg.errorMessage!,
          deviceName: thingName,
        });
      }
      break;
    }
  }
}
