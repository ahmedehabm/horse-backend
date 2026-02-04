// src/services/feedingService.ts
import { prisma } from "../lib/prisma.js";
import { FeedingStatus } from "@prisma/client";
import { publishFeedCommand, publishStreamCommand } from "../iot/initAwsIot.js";
import AppError from "../utils/appError.js";
import { broadcastFeedingStatus } from "../ws/clientWs.js";
export async function startFeeding(horseId, amountKg, userId) {
    if (!horseId || !userId || amountKg <= 0 || amountKg > 50) {
        // Reasonable max 50kg per feeding
        throw new AppError("Invalid input parameters", 400);
    }
    // Find horse + verify feeder exists & is FEEDER type
    const horse = await prisma.horse.findUnique({
        where: { id: horseId, ownerId: userId },
        include: {
            feeder: {
                where: { deviceType: "FEEDER" },
            },
        },
    });
    if (!horse || !horse.feeder) {
        throw new AppError("Horse has no valid feeder assigned", 404);
    }
    const feeder = horse.feeder;
    if (feeder.deviceType !== "FEEDER") {
        throw new AppError("Assigned device is not a feeder", 400);
    }
    // Create feeding record (deviceId instead of feederId)
    const feeding = await prisma.feeding.create({
        data: {
            horseId: horse.id,
            deviceId: feeder.id,
            requestedKg: amountKg,
            status: FeedingStatus.PENDING,
        },
    });
    //send to the client after creation in database
    await broadcastFeedingStatus({
        type: "FEEDING_STATUS",
        status: "PENDING",
        feedingId: feeding.id,
        horseId,
        deviceName: feeder.thingName,
    });
    //  Send AWS IoT command to device
    await publishFeedCommand(feeder.thingName, {
        type: "FEED_COMMAND",
        feedingId: feeding.id,
        targetKg: amountKg,
        horseId: horse.id,
    });
    console.log(`🐴 Feeding started: ${horse.name} (${amountKg}kg) via ${feeder.thingName}`);
    return {
        feeding,
        horse,
        device: feeder,
    };
}
/**
 * Start camera streaming for horse
 */
export async function startStreaming(horseId, userId) {
    //validate
    //  Find horse + verify camera exists & is CAMERA type
    const horse = await prisma.horse.findUnique({
        where: { id: horseId, ownerId: userId },
        include: {
            camera: {
                where: { deviceType: "CAMERA" },
            },
        },
    });
    if (!horse || !horse.camera) {
        throw new AppError("Horse has no valid camera assigned", 404);
    }
    const camera = horse.camera;
    await broadcastFeedingStatus({
        type: "STREAM_STATUS",
        status: "PENDING",
        horseId,
        deviceName: camera.thingName,
        streamUrl: "WORKING ON...",
    });
    //  Send AWS IoT STREAM_COMMAND
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
//# sourceMappingURL=deviceService.js.map