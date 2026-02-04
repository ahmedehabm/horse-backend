// src/services/streamService.ts
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import AppError from "../utils/appError.js";
/**
 * Hash a token using SHA256
 */
function hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}
/**
 * Generate a stream token and store its hash in the database
 * ✅ Now works for CAMERA devices only
 */
export async function generateStreamToken(deviceId) {
    // ✅ Verify device exists and is CAMERA type
    const device = await prisma.device.findUnique({
        where: { id: deviceId },
        select: {
            id: true,
            deviceType: true,
            thingName: true,
        },
    });
    if (!device) {
        throw new AppError("Device not found", 404);
    }
    if (device.deviceType !== "CAMERA") {
        throw new AppError("Only CAMERA devices can generate stream tokens", 400);
    }
    // Generate random token to send to client
    const token = crypto.randomBytes(32).toString("hex");
    // Hash the token before storing in database
    const hashedToken = hashToken(token);
    await prisma.device.update({
        where: { id: deviceId },
        data: {
            streamToken: hashedToken, // ✅ Device.streamToken
            streamTokenIsValid: true, // ✅ Device.streamTokenIsValid
        },
    });
    console.log(`📹 Stream token generated for camera: ${device.thingName}`);
    return { token }; // Return unhashed token to client
}
/**
 * Validate stream token by hashing and comparing
 * ✅ Returns camera device ID if valid
 */
export async function validateStreamToken(token) {
    const hashedToken = hashToken(token);
    const device = await prisma.device.findFirst({
        where: {
            streamToken: hashedToken,
            streamTokenIsValid: true,
            deviceType: "CAMERA", // ✅ Only CAMERA devices
        },
        select: {
            id: true,
            thingName: true,
        },
    });
    if (!device) {
        return null;
    }
    return device;
}
/**
 * Invalidate stream token
 */
export async function invalidateStreamToken(deviceId) {
    // ✅ Verify device exists before invalidating
    const device = await prisma.device.findUnique({
        where: { id: deviceId },
        select: { id: true, deviceType: true },
    });
    if (!device || device.deviceType !== "CAMERA") {
        throw new AppError("Camera device not found", 404);
    }
    await prisma.device.update({
        where: { id: deviceId },
        data: {
            streamToken: null,
            streamTokenIsValid: false,
        },
    });
    console.log(`🔒 Stream token invalidated for device: ${deviceId}`);
}
/**
 * Get camera details by stream token (for stream endpoints)
 */
export async function getCameraByToken(token) {
    const device = await validateStreamToken(token);
    if (!device) {
        throw new AppError("Invalid or expired stream token", 401);
    }
    return device;
}
//# sourceMappingURL=streamService.js.map