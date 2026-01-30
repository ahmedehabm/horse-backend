// src/services/feedingService.ts
import { prisma } from "../lib/prisma.js";
import { FeedingStatus } from "@prisma/client";
import { publishFeedCommand, publishStreamCommand } from "../iot/initAwsIot.js";
import AppError from "../utils/appError.js";

export async function startFeeding(horseId: string, amountKg: number) {
  // ✅ Find horse + verify feeder exists & is FEEDER type
  const horse = await prisma.horse.findUnique({
    where: { id: horseId },
    include: {
      feeder: {
        // ✅ Only FEEDER devices (not cameras)
        where: { deviceType: "FEEDER" },
      },
    },
  });

  if (!horse || !horse.feeder) {
    throw new AppError("Horse has no valid feeder assigned", 404);
  }

  const feeder = horse.feeder; // Exactly 1 feeder per horse

  // ✅ Verify device is actually a FEEDER (double-check)
  if (feeder.deviceType !== "FEEDER") {
    throw new AppError("Assigned device is not a feeder", 404);
  }

  // ✅ Create feeding record (deviceId instead of feederId)
  const feeding = await prisma.feeding.create({
    data: {
      horseId: horse.id,
      deviceId: feeder.id,
      requestedKg: amountKg,
      status: FeedingStatus.PENDING,
    },
  });

  // ✅ Send AWS IoT command to device
  await publishFeedCommand(feeder.thingName, {
    type: "FEED_COMMAND",
    feedingId: feeding.id,
    targetKg: amountKg,
    horseId: horse.id,
  });

  console.log(
    `🐴 Feeding started: ${horse.name} (${amountKg}kg) via ${feeder.thingName}`,
  );

  return {
    feeding,
    horse,
    device: feeder,
  };
}

/**
 * Start camera streaming for horse
 */

export async function startStreaming(horseId: string) {
  // ✅ Find horse + verify camera exists & is CAMERA type
  const horse = await prisma.horse.findUnique({
    where: { id: horseId },
    include: {
      camera: {
        where: { deviceType: "CAMERA" },
      },
    },
  });

  if (!horse || !horse.camera) {
    throw new AppError("Horse has no valid camera assigned", 404);
  }

  const camera = horse.camera; // ✅ Single Device object (1:1 relation)

  // ✅ Verify device is actually a CAMERA
  if (camera.deviceType !== "CAMERA") {
    throw new AppError("Assigned device is not a camera", 404);
  }

  // ✅ Send AWS IoT STREAM_COMMAND
  await publishStreamCommand(camera.thingName, {
    type: "STREAM_COMMAND",
    horseId: horse.id,
  });

  console.log(`📹 Streaming started: ${horse.name} via ${camera.thingName}`);

  return {
    horse,
    device: camera,
  };
}
