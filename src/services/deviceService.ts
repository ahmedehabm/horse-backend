// src/services/feedingService.ts
import { prisma } from "../lib/prisma.js";
import { DeviceType, FeedingStatus } from "@prisma/client";
import { publishFeedCommand, publishStreamCommand } from "../iot/initAwsIot.js";
import AppError from "../utils/appError.js";
import { broadcastFeedingStatus } from "../ws/clientWs.js";

export async function startFeeding(
  horseId: string,
  amountKg: number,
  userId: string,
) {
  // Use transaction to prevent race conditions
  const result = await prisma.$transaction(async (tx) => {
    // 1) Find horse + verify ownership (with lock)
    const horse = await tx.horse.findUnique({
      where: { id: horseId, ownerId: userId },
      select: { id: true, name: true, feederId: true },
    });

    if (!horse) {
      throw new AppError("Horse Forbidden", 403);
    }

    if (!horse.feederId) {
      throw new AppError("Horse has no assigned feeder", 404);
    }

    // 2) Get feeder
    const feeder = await tx.device.findUnique({
      where: { id: horse.feederId },
      select: { id: true, thingName: true, deviceType: true },
    });

    if (!feeder) {
      throw new AppError("Feeder device not found", 404);
    }

    if (feeder.deviceType !== DeviceType.FEEDER) {
      throw new AppError("Assigned device is not a feeder", 400);
    }

    // 3) Block if feeding already active
    const activeFeeding = await tx.feeding.findFirst({
      where: {
        horseId: horse.id,
        status: { in: ["PENDING", "STARTED", "RUNNING"] },
      },
      select: { status: true },
    });

    if (activeFeeding) {
      throw new AppError(
        `Feeding already in progress (${activeFeeding.status})`,
        409,
      );
    }

    // 4) Create feeding record (inside transaction)
    const feeding = await tx.feeding.create({
      data: {
        horseId: horse.id,
        deviceId: feeder.id,
        requestedKg: amountKg,
        status: FeedingStatus.PENDING,
      },
      select: { id: true, horseId: true, deviceId: true, status: true },
    });

    return { feeding, horse, feeder };
  });

  // 5) Outside transaction: Broadcast and send IoT command
  await broadcastFeedingStatus({
    type: "FEEDING_STATUS",
    status: "PENDING",
    feedingId: result.feeding.id,
    horseId,
  });

  await publishFeedCommand(result.feeder.thingName, {
    type: "FEED_COMMAND",
    feedingId: result.feeding.id,
    targetKg: amountKg,
    horseId: result.horse.id,
  });

  console.log(
    `🐴 Feeding started: ${result.horse.name} (${amountKg}kg) via ${result.feeder.thingName}`,
  );

  return result;
}

/**
 * Start camera streaming for horse
 */

export async function startStreaming(horseId: string, userId: string) {
  // 1) Minimal horse lookup + ownership check
  const horse = await prisma.horse.findFirst({
    where: { id: horseId, ownerId: userId },
    select: { id: true, name: true, cameraId: true },
  });

  if (!horse) {
    throw new AppError("Forbidden horseId", 403);
  }

  if (!horse.cameraId) {
    throw new AppError("Horse has no camera assigned", 404);
  }

  // 2) Minimal device lookup
  const camera = await prisma.device.findUnique({
    where: { id: horse.cameraId },
    select: { id: true, thingName: true, deviceType: true },
  });

  if (!camera) {
    throw new AppError("Camera device not found", 404);
  }
  if (camera.deviceType !== DeviceType.CAMERA) {
    throw new AppError("Assigned device is not a camera", 400);
  }

  // Optional: immediately tell UI we're requesting stream
  await broadcastFeedingStatus({
    type: "STREAM_STATUS",
    status: "PENDING",
    horseId: horse.id,
    streamUrl: "WORKING ON...",
  });

  // 3) Send AWS IoT command
  await publishStreamCommand(camera.thingName, {
    type: "STREAM_COMMAND",
    horseId: horse.id,
  });

  return { horse, device: camera };
}
