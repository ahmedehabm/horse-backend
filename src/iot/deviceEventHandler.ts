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
  try {
    const { msg, thingName } = event;

    // 1) Load the device by thingName (minimal)
    const device = await prisma.device.findUnique({
      where: { thingName },
      select: { id: true, deviceType: true },
    });

    if (!device || device.deviceType !== "FEEDER") {
      throw new AppError("Not a valid feeder device", 404);
    }

    // 2) Load the feeding by id (minimal)
    const feeding = await prisma.feeding.findUnique({
      where: { id: msg.feedingId, horseId: msg.horseId },
      select: { id: true, horseId: true, deviceId: true },
    });

    if (!feeding) {
      throw new AppError("Feeding not found", 404);
    }

    // 3) Validate the feeding belongs to this feeder device
    if (feeding.deviceId !== device.id) {
      throw new AppError("this device not for this process", 404);
    }

    const horseId = feeding.horseId;
    const feedingId = feeding.id;

    // 4) Switch does only updates + broadcasts
    switch (msg.type) {
      case "FEEDING_STARTED": {
        await prisma.feeding.update({
          where: { id: feedingId },
          data: { status: FeedingStatus.STARTED, startedAt: new Date() },
        });

        await broadcastFeedingStatus({
          type: "FEEDING_STATUS",
          horseId,
          feedingId,
          status: "STARTED",
        });
        break;
      }

      case "FEEDING_RUNNING": {
        await prisma.feeding.update({
          where: { id: feedingId },
          data: { status: FeedingStatus.RUNNING },
        });

        await broadcastFeedingStatus({
          type: "FEEDING_STATUS",
          horseId,
          feedingId,
          status: "RUNNING",
        });
        break;
      }

      case "FEEDING_COMPLETED": {
        const now = new Date();

        await prisma.feeding.update({
          where: { id: feedingId },
          data: { status: FeedingStatus.COMPLETED, completedAt: now },
        });

        await broadcastFeedingStatus({
          type: "FEEDING_STATUS",
          horseId,
          feedingId,
          status: "COMPLETED",
        });

        await prisma.horse.update({
          where: { id: horseId },
          data: { lastFeedAt: now },
        });
        break;
      }

      case "FEEDING_ERROR": {
        await prisma.feeding.update({
          where: { id: feedingId },
          data: { status: FeedingStatus.FAILED },
        });

        await broadcastFeedingStatus({
          type: "FEEDING_STATUS",
          horseId,
          feedingId,
          status: "FAILED",
          errorMessage: msg.errorMessage ?? "Unknown feeder error",
        });
        break;
      }
    }
  } catch (err) {
    console.error("Broadcast error", err);
    return;
  }
}

/**
 *
 * LOCAL HELPER: Handle CAMERA events ONLY (ALL stream token logic here!)
 *
 */
async function handleCameraEvent(
  event: DeviceEvent & { msg: CameraEventMessage },
): Promise<void> {
  try {
    const { msg, thingName } = event;

    // 1) Find camera device (minimal)
    const device = await prisma.device.findUnique({
      where: { thingName },
      select: { id: true, deviceType: true },
    });

    if (!device || device.deviceType !== "CAMERA") {
      throw new AppError("Not a valid cam", 404);
    }

    // 2) Find the horse that uses this camera (minimal)
    // Because Horse.cameraId is @unique, there will be at most one.
    const horse = await prisma.horse.findFirst({
      where: { cameraId: device.id, id: msg.horseId },
      select: { id: true },
    });

    if (!horse) {
      throw new AppError("No horse linked to this camera", 404);
    }

    // 3) Switch: token + broadcasts only
    switch (msg.type) {
      case "STREAM_STARTED": {
        const { token } = await generateStreamToken(device.id);

        await broadcastFeedingStatus({
          type: "STREAM_STATUS",
          horseId: horse.id,
          status: "STARTED",
          streamUrl: `/stream/${token}`,
        });
        break;
      }

      // case "STREAM_STOPPED": {
      //   await invalidateStreamToken(device.id);

      //   await broadcastFeedingStatus({
      //     type: "STREAM_STATUS",
      //     horseId: horse.id,
      //     status: "ENDED",
      //     streamUrl: "ENDED",
      //   });
      //   break;
      // }

      case "STREAM_ERROR": {
        await invalidateStreamToken(device.id);

        await broadcastFeedingStatus({
          type: "STREAM_STATUS",
          horseId: horse.id,
          status: "ERROR",
          streamUrl: "ENDED",
          errorMessage: msg.errorMessage ?? "Unknown stream error",
        });
        break;
      }
    }
  } catch (error) {
    console.error("BroadCast Error ", error);
  }
}
