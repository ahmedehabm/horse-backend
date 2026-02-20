// src/services/streamService.ts
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import AppError from "../utils/appError.js";

/**
 * Generate a stream token and store it PLAIN in the database
 * works for CAMERA devices only
 */
export async function generateStreamToken(
  deviceId: string,
  tx?: any,
): Promise<{ token: string }> {
  const client = tx || prisma;
  // Generate random token
  const token = crypto.randomBytes(32).toString("hex");

  //  Store token as-is (no hashing)
  await client.device.update({
    where: { id: deviceId },
    data: {
      streamToken: token,
      streamTokenIsValid: true,
    },
  });

  console.log(`📹 Stream token generated for camera: ${deviceId}`);

  return { token };
}

/**
 * Validate stream token by direct comparison
 * Returns camera device ID if valid
 */
export async function validateStreamToken(token: string) {
  // Compare directly (no hashing)
  const device = await prisma.device.findFirst({
    where: {
      streamToken: token,
      streamTokenIsValid: true,
      deviceType: "CAMERA",
    },
    select: {
      id: true,
      thingName: true,
      horsesAsCamera: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!device) {
    return null;
  }

  return {
    id: device.id,
    thingName: device.thingName,
    horseId: device.horsesAsCamera[0]?.id,
  };
}

/**
 * Invalidate stream token
 */
export async function invalidateStreamToken(deviceId: string, tx?: any) {
  const client = tx || prisma;

  await client.device.update({
    where: { id: deviceId },
    data: { streamToken: null, streamTokenIsValid: false },
  });
}
/**
 * Get camera details by stream token (for stream endpoints)
 */
export async function getCameraByToken(token: string) {
  const device = await validateStreamToken(token);
  if (!device) {
    throw new AppError("Invalid or expired stream token", 401);
  }
  return device;
}
