// src/services/streamService.ts
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import AppError from "../utils/appError.js";

/**
 * Hash a token using SHA256
 */
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Generate a stream token and store its hash in the database
 * works for CAMERA devices only
 */

export async function generateStreamToken(
  deviceId: string,
  tx?: any,
): Promise<{ token: string }> {
  const client = tx || prisma;
  // Generate random token to send to client
  const token = crypto.randomBytes(32).toString("hex");

  // Hash the token before storing in database
  const hashedToken = hashToken(token);

  await client.device.update({
    where: { id: deviceId },
    data: {
      streamToken: hashedToken,
      streamTokenIsValid: true,
    },
  });

  console.log(`📹 Stream token generated for camera: ${deviceId}`);

  return { token }; // Return unhashed
}

/**
 * Validate stream token by hashing and comparing
 *  Returns camera device ID if valid
 */
export async function validateStreamToken(token: string) {
  const hashedToken = hashToken(token);

  const device = await prisma.device.findFirst({
    where: {
      streamToken: hashedToken,
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
export async function invalidateStreamToken(
  deviceId: string,
  tx?: any, // Or: tx?: Prisma.TransactionClient
) {
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
