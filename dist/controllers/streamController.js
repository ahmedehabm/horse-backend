import { prisma } from "../lib/prisma.js";
import AppError from "../utils/appError.js";
/**
 * Middleware 1: Validate stream token exists and is valid
 */
export const validateStreamToken = async (req, res, next) => {
    try {
        const { token } = req.params;
        if (!token) {
            return next(new AppError("Stream token is required", 400));
        }
        // Check if token exists and is valid
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
                    select: { id: true, ownerId: true },
                },
            },
        });
        if (!device) {
            return next(new AppError("Invalid or expired stream token", 401));
        }
        if (!device.horsesAsCamera[0]) {
            return next(new AppError("Camera not linked to any horse", 404));
        }
        // Attach to request for next middleware
        req.streamData = {
            deviceId: device.id,
            thingName: device.thingName,
            horseId: device.horsesAsCamera[0].id,
            horseOwnerId: device.horsesAsCamera[0].ownerId,
        };
        next();
    }
    catch (error) {
        next(error);
    }
};
/**
 * Middleware 2: Verify user owns the horse and has active stream
 */
export const verifyActiveStream = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { horseId, horseOwnerId } = req.streamData;
        // Check 1: User owns this horse
        if (horseOwnerId !== userId) {
            return next(new AppError("You do not own this horse", 403));
        }
        // Check 2: User has this horse as active stream
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { activeStreamHorseId: true },
        });
        if (user?.activeStreamHorseId !== horseId) {
            return next(new AppError("No active stream for this horse. Please start stream first.", 403));
        }
        next();
    }
    catch (error) {
        next(error);
    }
};
//# sourceMappingURL=streamController.js.map