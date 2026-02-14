// src/services/feedingService.ts
import { prisma } from "../lib/prisma.js";
import { DeviceType, FeedingStatus } from "@prisma/client";
import { publishFeedCommand, publishStreamCommand } from "../iot/initAwsIot.js";
import AppError from "../utils/appError.js";
import { broadcastStatus } from "../ws/clientWs.js";
import { generateStreamToken, invalidateStreamToken } from "./streamService.js";
import { parentPort } from "worker_threads";

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
    const activeFeeding = await tx.activeFeeding.findUnique({
      where: { horseId: horse.id },
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

    // 5) Create live snapshot (THE IMPORTANT PART)
    await tx.activeFeeding.create({
      data: {
        horseId: horse.id,
        deviceId: feeder.id,
        feedingId: feeding.id,
        status: FeedingStatus.PENDING,
        requestedKg: amountKg,
      },
    });

    return { feeding, horse, feeder };
  });

  // 5) Outside transaction: Broadcast and send IoT command
  await broadcastStatus({
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

export async function startStreaming(horseId: string, userId: string) {
  const result = await prisma.$transaction(async (tx) => {
    //  Single query with include (most performant for happy path which it is that you dont expect many errors )
    const horse = await tx.horse.findFirst({
      where: { id: horseId, ownerId: userId },
      include: {
        camera: {
          select: { id: true, thingName: true, deviceType: true },
        },
      },
    });

    if (!horse) throw new AppError("Horse not found or forbidden", 403);
    if (!horse.camera) throw new AppError("Horse has no camera assigned", 404);
    if (horse.camera.deviceType !== DeviceType.CAMERA) {
      throw new AppError("Assigned device is not a camera", 400);
    }

    // Check user's active stream
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { activeStreamHorseId: true },
    });

    if (!user) throw new AppError("User not found", 404);

    if (user.activeStreamHorseId === horseId) {
      throw new AppError("Stream already active for this horse", 409);
    }

    // Get previous camera if switching
    const prevHorseId = user.activeStreamHorseId;

    let prevCameraThingName: string | null = null;

    if (prevHorseId) {
      const prevHorse = await tx.horse.findFirst({
        where: { id: prevHorseId, ownerId: userId },
        select: {
          camera: { select: { thingName: true } },
        },
      });
      prevCameraThingName = prevHorse?.camera?.thingName ?? null;
    }

    // Update active stream

    await tx.user.update({
      where: { id: userId },
      data: { activeStreamHorseId: horseId },
    });

    return {
      horse: { id: horse.id, name: horse.name },
      camera: horse.camera,
      prevHorseId,
      prevCameraThingName,
    };
  });

  // Publish MQTT commands outside transaction
  if (result.prevCameraThingName) {
    await publishStreamCommand(result.prevCameraThingName, {
      type: "STREAM_STOP_COMMAND",
      horseId: result.prevHorseId!,
    });
  }

  await publishStreamCommand(result.camera.thingName, {
    type: "STREAM_START_COMMAND",
    horseId: result.horse.id,
  });

  return {
    horse: result.horse,
    device: result.camera,
    status: "PENDING",
  };
}

export async function stopStreaming(horseId: string, userId: string) {
  console.log("STOP_STREAMING called", {
    horseId,
    userId,
    pid: process.pid,
    stack: new Error().stack,
  });

  const result = await prisma.$transaction(async (tx) => {
    // 1) Verify ownership and get horse
    const horse = await tx.horse.findFirst({
      where: { id: horseId, ownerId: userId },
      select: { id: true, cameraId: true },
    });

    if (!horse) throw new AppError("Forbidden horseId", 403);
    if (!horse.cameraId)
      throw new AppError("Horse has no camera assigned", 404);

    // 2) Get camera device
    const camera = await tx.device.findUnique({
      where: { id: horse.cameraId },
      select: { id: true, thingName: true, deviceType: true },
    });

    if (!camera) throw new AppError("Camera device not found", 404);
    if (camera.deviceType !== DeviceType.CAMERA) {
      throw new AppError("Assigned device is not a camera", 400);
    }

    // 3) Check if this horse is actually being streamed by this user
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { activeStreamHorseId: true },
    });

    if (!user) throw new AppError("User not found", 404);
    if (user.activeStreamHorseId !== horseId) {
      throw new AppError("This horse is not currently streaming", 409);
    }

    // 4) Clear user's active stream
    await tx.user.update({
      where: { id: userId },
      data: { activeStreamHorseId: null },
    });

    // 5) Invalidate token
    await invalidateStreamToken(camera.id, tx);

    return { horse, camera };
  });

  // 6) Publish STOP command OUTSIDE transaction
  await publishStreamCommand(result.camera.thingName, {
    type: "STREAM_STOP_COMMAND",
    horseId: result.horse.id,
  });

  return { horse: result.horse, device: result.camera };
}

export async function startScheduledFeeding(
  deviceId: string,
  timeSlot: "morning" | "day" | "night" = "morning",
) {
  const result = await prisma.$transaction(async (tx) => {
    // 1) Get the device with its assigned horse
    const device = (await tx.device.findUnique({
      where: { id: deviceId, feederType: "SCHEDULED" },
      select: {
        id: true,
        thingName: true,
        scheduledAmountKg: true,
        horsesAsFeeder: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })) as any;

    if (!device) {
      throw new AppError("Device not found or not a scheduled feeder", 404);
    }

    // horsesAsFeeder is an array, get the first one
    const horse = device.horsesAsFeeder[0];

    if (!horse) {
      throw new AppError("No horse assigned to this feeder", 404);
    }

    const amountKg = Number(device.scheduledAmountKg || 2.0);

    // 2) Block if active feeding exists
    const activeFeeding = await tx.activeFeeding.findUnique({
      where: { horseId: horse.id },
      select: { id: true, status: true },
    });

    if (activeFeeding) {
      throw new AppError(
        `Feeding already in progress (${activeFeeding.status})`,
        409,
      );
    }

    // 3) Create Feeding
    const feeding = await tx.feeding.create({
      data: {
        horseId: horse.id,
        deviceId: device.id,
        requestedKg: amountKg,
        status: FeedingStatus.PENDING,
        isScheduled: true,
        timeSlot,
      },
      select: { id: true, horseId: true, deviceId: true, status: true },
    });

    // 4) Create active snapshot
    await tx.activeFeeding.create({
      data: {
        horseId: horse.id,
        deviceId: device.id,
        feedingId: feeding.id,
        status: FeedingStatus.PENDING,
        requestedKg: amountKg,
      },
    });

    return { feeding, horse, feeder: device };
  });

  parentPort?.postMessage({
    type: "SCHEDULED_FEED_STARTED",
    payload: {
      horseId: result.horse.id,
      feedingId: result.feeding.id,
      thingName: result.feeder.thingName,
      targetKg: result.feeder.scheduledAmountKg || 2.0,
    },
  });

  console.log(
    `🕐 Scheduled ${timeSlot} feed: ${result.horse.name} (${result.feeder.scheduledAmountKg}kg)`,
  );

  return result;
}
