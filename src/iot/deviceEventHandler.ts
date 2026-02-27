// // src/iot/deviceEventHandler.ts
// import { prisma } from "../lib/prisma.js";
// import { FeedingStatus } from "@prisma/client";
// import { broadcastStatus } from "../ws/clientWs.js";
// import type {
//   DeviceEvent,
//   FeedEventMessage,
//   CameraEventMessage,
// } from "../types/globalTypes.js";
// import AppError from "../utils/appError.js";
// import {
//   generateStreamToken,
//   invalidateStreamToken,
// } from "../services/streamService.js";

// /**
//  * BIG ROUTER FUNCTION - Routes FEEDER vs CAMERA events
//  */
// export async function handleDeviceEvent(event: DeviceEvent): Promise<void> {
//   const { msg, thingName, topic } = event;

//   // ✅ Route by device type (topic prefix)
//   if (topic.startsWith("feeders/")) {
//     await handleFeederEvent(event as DeviceEvent & { msg: FeedEventMessage });
//   } else if (topic.startsWith("cameras/")) {
//     await handleCameraEvent(event as DeviceEvent & { msg: CameraEventMessage });
//   } else {
//     console.warn(`⚠️ Unknown device type: ${topic}`);
//   }
// }

// /**
//  * LOCAL HELPER: Handle FEEDER events ONLY (NO stream token logic!)
//  */
// async function handleFeederEvent(
//   event: DeviceEvent & { msg: FeedEventMessage },
// ): Promise<void> {
//   try {
//     const { msg, thingName } = event;

//     // 1) Load the device by thingName (minimal)
//     const device = await prisma.device.findUnique({
//       where: { thingName },
//       select: { id: true, deviceType: true },
//     });

//     if (!device || device.deviceType !== "FEEDER") {
//       throw new AppError("Not a valid feeder device", 404);
//     }

//     // 2) Load feeding (history)
//     const feeding = await prisma.feeding.findUnique({
//       where: { id: msg.feedingId },
//       select: { id: true, horseId: true, deviceId: true },
//     });

//     if (!feeding) {
//       throw new AppError("Feeding not found", 404);
//     }

//     // 3) Validate ownership
//     if (feeding.deviceId !== device.id) {
//       throw new AppError("This device is not assigned to this feeding", 403);
//     }

//     const horseId = feeding.horseId;
//     const feedingId = feeding.id;

//     // 4) State transitions
//     switch (msg.type) {
//       case "FEEDING_STARTED": {
//         await prisma.$transaction([
//           prisma.feeding.update({
//             where: { id: feedingId },
//             data: { status: FeedingStatus.STARTED, startedAt: new Date() },
//           }),
//           prisma.activeFeeding.update({
//             where: { horseId },
//             data: { status: FeedingStatus.STARTED, startedAt: new Date() },
//           }),
//         ]);

//         await broadcastStatus({
//           type: "FEEDING_STATUS",
//           horseId,
//           feedingId,
//           status: "STARTED",
//         });
//         break;
//       }

//       case "FEEDING_RUNNING": {
//         await prisma.$transaction([
//           prisma.feeding.update({
//             where: { id: feedingId },
//             data: { status: FeedingStatus.RUNNING },
//           }),
//           prisma.activeFeeding.update({
//             where: { horseId },
//             data: { status: FeedingStatus.RUNNING },
//           }),
//         ]);

//         await broadcastStatus({
//           type: "FEEDING_STATUS",
//           horseId,
//           feedingId,
//           status: "RUNNING",
//         });
//         break;
//       }

//       case "FEEDING_COMPLETED": {
//         const now = new Date();

//         await prisma.$transaction([
//           prisma.feeding.update({
//             where: { id: feedingId },
//             data: {
//               status: FeedingStatus.COMPLETED,
//               completedAt: now,
//             },
//           }),
//           prisma.activeFeeding.delete({
//             where: { horseId },
//           }),
//           prisma.horse.update({
//             where: { id: horseId },
//             data: { lastFeedAt: now },
//           }),
//         ]);

//         await broadcastStatus({
//           type: "FEEDING_STATUS",
//           horseId,
//           feedingId,
//           status: "COMPLETED",
//         });
//         break;
//       }

//       case "FEEDING_ERROR": {
//         await prisma.$transaction([
//           prisma.feeding.update({
//             where: { id: feedingId },
//             data: { status: FeedingStatus.FAILED },
//           }),
//           prisma.activeFeeding.delete({
//             where: { horseId },
//           }),
//         ]);

//         await broadcastStatus({
//           type: "FEEDING_STATUS",
//           horseId,
//           feedingId,
//           status: "FAILED",
//           errorMessage: msg.errorMessage ?? "Unknown feeder error",
//         });
//         break;
//       }
//     }
//   } catch (err) {
//     console.error("Feeder event handling error", err);
//   }
// }

// /**
//  *
//  * LOCAL HELPER: Handle CAMERA events ONLY (ALL stream token logic here!)
//  *
//  */
// async function handleCameraEvent(
//   event: DeviceEvent & { msg: CameraEventMessage },
// ): Promise<void> {
//   try {
//     const { msg, thingName } = event;

//     // 1) Find camera device (minimal)
//     const device = await prisma.device.findUnique({
//       where: { thingName },
//       select: { id: true, deviceType: true },
//     });

//     if (!device || device.deviceType !== "CAMERA") {
//       throw new AppError("Not a valid cam", 404);
//     }

//     // 2) Find the horse that uses this camera (minimal)
//     const horse = await prisma.horse.findFirst({
//       where: { cameraId: device.id, id: msg.horseId },
//       select: { id: true },
//     });

//     if (!horse) {
//       throw new AppError("No horse linked to this camera", 404);
//     }

//     // 3) Switch: token + broadcasts only
//     switch (msg.type) {
//       case "STREAM_STARTED": {
//         const { token } = await generateStreamToken(device.id);

//         await broadcastStatus({
//           type: "STREAM_STATUS",
//           horseId: horse.id,
//           status: "STARTED",
//           streamUrl: `/stream/${token}`,
//         });
//         break;
//       }

//       // case "STREAM_STOPPED": {
//       //   await invalidateStreamToken(device.id);

//       //   await broadcastStatus({
//       //     type: "STREAM_STATUS",
//       //     horseId: horse.id,
//       //     status: "ENDED",
//       //     streamUrl: "ENDED",
//       //   });
//       //   break;
//       // }

//       case "STREAM_ERROR": {
//         await invalidateStreamToken(device.id);

//         await broadcastStatus({
//           type: "STREAM_STATUS",
//           horseId: horse.id,
//           status: "ERROR",
//           streamUrl: "ENDED",
//           errorMessage: msg.errorMessage ?? "Unknown stream error",
//         });
//         break;
//       }
//     }
//   } catch (error) {
//     console.error("BroadCasttttttttttt Error ", error);
//   }
// }

// src/iot/deviceEventHandler.ts
import { prisma } from "../lib/prisma.js";
import { FeedingStatus } from "@prisma/client";
import { broadcastStatus } from "../ws/clientWs.js";
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
  const { topic } = event;

  if (topic.startsWith("feeders/")) {
    await handleFeederEvent(event as DeviceEvent & { msg: FeedEventMessage });
  } else if (topic.startsWith("cameras/")) {
    await handleCameraEvent(event as DeviceEvent & { msg: CameraEventMessage });
  } else {
    console.warn(`Unknown device type: ${topic}`);
  }
}

/**
 * LOCAL HELPER: Handle FEEDER events ONLY
 */
async function handleFeederEvent(
  event: DeviceEvent & { msg: FeedEventMessage },
): Promise<void> {
  try {
    const { msg, thingName } = event;

    const device = await prisma.device.findUnique({
      where: { thingName },
      select: { id: true, deviceType: true },
    });

    if (!device || device.deviceType !== "FEEDER") {
      throw new AppError("Not a valid feeder device", 404);
    }

    const feeding = await prisma.feeding.findUnique({
      where: { id: msg.feedingId },
      select: {
        id: true,
        horseId: true,
        deviceId: true,
        horse: { select: { ownerId: true } },
      },
    });

    if (!feeding) {
      throw new AppError("Feeding not found", 404);
    }

    if (feeding.deviceId !== device.id) {
      throw new AppError("This device is not assigned to this feeding", 403);
    }

    if (!feeding.horse.ownerId) {
      throw new AppError("Horse has no owner", 404);
    }

    const horseId = feeding.horseId;
    const feedingId = feeding.id;
    const ownerId = feeding.horse.ownerId;

    switch (msg.type) {
      case "FEEDING_STARTED": {
        await prisma.activeFeeding.update({
          where: { horseId },
          data: { status: FeedingStatus.STARTED, startedAt: new Date() },
        });

        await broadcastStatus({
          type: "FEEDING_STATUS",
          horseId,
          feedingId,
          status: "STARTED",
          ownerId,
        });
        break;
      }

      case "FEEDING_RUNNING": {
        await prisma.activeFeeding.update({
          where: { horseId },
          data: { status: FeedingStatus.RUNNING },
        });

        await broadcastStatus({
          type: "FEEDING_STATUS",
          horseId,
          feedingId,
          status: "RUNNING",
          ownerId,
        });
        break;
      }

      case "FEEDING_COMPLETED": {
        const now = new Date();

        await prisma.$transaction([
          prisma.feeding.update({
            where: { id: feedingId },
            data: {
              status: FeedingStatus.COMPLETED,
              completedAt: now,
            },
          }),
          prisma.activeFeeding.delete({
            where: { horseId },
          }),
          prisma.horse.update({
            where: { id: horseId },
            data: { lastFeedAt: now },
          }),
        ]);

        await broadcastStatus({
          type: "FEEDING_STATUS",
          horseId,
          feedingId,
          status: "COMPLETED",
          ownerId,
        });
        break;
      }

      case "FEEDING_ERROR": {
        await prisma.$transaction([
          prisma.feeding.update({
            where: { id: feedingId },
            data: { status: FeedingStatus.FAILED },
          }),
          prisma.activeFeeding.delete({
            where: { horseId },
          }),
        ]);

        await broadcastStatus({
          type: "FEEDING_STATUS",
          horseId,
          feedingId,
          status: "FAILED",
          errorMessage: msg.errorMessage ?? "Unknown feeder error",
          ownerId,
        });
        break;
      }
    }
  } catch (err) {
    console.error("Feeder event handling error", err);
    throw err;
  }
}

//testing
// async function handleFeederEvent(
//   event: DeviceEvent & { msg: FeedEventMessage },
// ): Promise<void> {
//   try {
//     const { msg, thingName } = event;

//     // 1) Validate device
//     const device = await prisma.device.findUnique({
//       where: { thingName },
//       select: { id: true, deviceType: true },
//     });

//     if (!device || device.deviceType !== "FEEDER") {
//       throw new AppError("Not a valid feeder device", 404);
//     }

//     // 2) Get feeding from DB (for validation)
//     const feeding = await prisma.feeding.findUnique({
//       where: { id: msg.feedingId },
//       select: {
//         id: true,
//         horseId: true,
//         deviceId: true,
//         horse: { select: { ownerId: true } },
//       },
//     });

//     if (!feeding) {
//       throw new AppError("Feeding not found", 404);
//     }

//     if (feeding.deviceId !== device.id) {
//       throw new AppError("Device mismatch", 403);
//     }

//     if (!feeding.horse.ownerId) {
//       throw new AppError("Horse has no owner", 404);
//     }

//     const horseId = feeding.horseId;
//     const feedingId = feeding.id;
//     const ownerId = feeding.horse.ownerId;

//     // 3) Get from cache
//     const activeFeeding = getActiveFeeding(horseId);

//     if (!activeFeeding) {
//       console.warn(`⚠️  No active feeding in cache for horse ${horseId}`);
//       // Don't throw - might be cache miss after restart
//     }

//     switch (msg.type) {
//       case "FEEDING_STARTED": {
//         // Update cache
//         updateActiveFeedingStatus(horseId, "STARTED", {
//           startedAt: new Date(),
//         });

//         // No DB write needed!

//         await broadcastStatus({
//           type: "FEEDING_STATUS",
//           horseId,
//           feedingId,
//           status: "STARTED",
//           ownerId,
//         });
//         break;
//       }

//       case "FEEDING_RUNNING": {
//         // Update cache
//         updateActiveFeedingStatus(horseId, "RUNNING");

//         // No DB write needed!

//         await broadcastStatus({
//           type: "FEEDING_STATUS",
//           horseId,
//           feedingId,
//           status: "RUNNING",
//           ownerId,
//         });
//         break;
//       }

//       case "FEEDING_COMPLETED": {
//         const now = new Date();

//         // Delete from cache
//         deleteActiveFeeding(horseId);

//         // Write to DB ONCE (final state only)
//         await prisma.$transaction([
//           prisma.feeding.update({
//             where: { id: feedingId },
//             data: {
//               status: FeedingStatus.COMPLETED,
//               completedAt: now,
//             },
//           }),
//           prisma.horse.update({
//             where: { id: horseId },
//             data: { lastFeedAt: now },
//           }),
//         ]);

//         await broadcastStatus({
//           type: "FEEDING_STATUS",
//           horseId,
//           feedingId,
//           status: "COMPLETED",
//           ownerId,
//         });
//         break;
//       }

//       case "FEEDING_ERROR": {
//         // Delete from cache
//         deleteActiveFeeding(horseId);

//         // Write to DB ONCE (final state only)
//         await prisma.feeding.update({
//           where: { id: feedingId },
//           data: { status: FeedingStatus.FAILED },
//         });

//         await broadcastStatus({
//           type: "FEEDING_STATUS",
//           horseId,
//           feedingId,
//           status: "FAILED",
//           errorMessage: msg.errorMessage ?? "Unknown feeder error",
//           ownerId,
//         });
//         break;
//       }
//     }
//   } catch (err) {
//     console.error("Feeder event handling error", err);
//     throw err;
//   }
// }

/**
 * LOCAL HELPER: Handle CAMERA events ONLY
 */
async function handleCameraEvent(
  event: DeviceEvent & { msg: CameraEventMessage },
): Promise<void> {
  try {
    const { msg, thingName } = event;

    const device = await prisma.device.findUnique({
      where: { thingName },
      select: { id: true, deviceType: true },
    });

    if (!device || device.deviceType !== "CAMERA") {
      throw new AppError("Not a valid cam", 404);
    }

    const horse = await prisma.horse.findFirst({
      where: { cameraId: device.id, id: msg.horseId },
      select: { id: true, ownerId: true },
    });

    if (!horse) {
      throw new AppError("No horse linked to this camera", 404);
    }

    if (!horse.ownerId) {
      throw new AppError("Horse has no owner", 404);
    }

    switch (msg.type) {
      case "STREAM_STARTED": {
        const { token } = await generateStreamToken(device.id);

        await broadcastStatus({
          type: "STREAM_STATUS",
          horseId: horse.id,
          status: "STARTED",
          streamUrl: `/stream/${token}`,
          ownerId: horse.ownerId,
        });
        break;
      }

      case "STREAM_ERROR": {
        await invalidateStreamToken(device.id);

        await broadcastStatus({
          type: "STREAM_STATUS",
          horseId: horse.id,
          status: "ERROR",
          streamUrl: "ENDED",
          errorMessage: msg.errorMessage ?? "Unknown stream error",
          ownerId: horse.ownerId,
        });
        break;
      }
    }
  } catch (error) {
    console.error("Camera event error", error);
    throw error;
  }
}
