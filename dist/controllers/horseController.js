// src/controllers/horseController.ts
import {} from "express";
import multer from "multer";
import AppError from "../utils/appError.js";
import { prisma } from "../lib/prisma.js";
import {} from "@prisma/client";
import { uploadImageAws } from "../lib/awsUpload.js";
const storage = multer.memoryStorage();
const fileFilter = (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new AppError("Only jpg, png, jpeg, webp supported", 400));
    }
};
export const uploadImage = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
}).single("image");
export const getAllHorses = async (req, res, next) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        // Define DEFAULT fields (relations included)
        const select = {
            id: true,
            name: true,
            image: true,
            owner: {
                select: {
                    name: true,
                },
            },
            camera: {
                select: {
                    thingLabel: true,
                },
            },
            feeder: {
                select: {
                    thingLabel: true,
                },
            },
        };
        //  Parse pagination
        const skip = (Number(page) - 1) * Number(limit);
        //  Execute queries
        const [horses, total] = await Promise.all([
            prisma.horse.findMany({
                select,
                skip,
                take: Number(limit),
                orderBy: { lastFeedAt: "desc" },
            }),
            prisma.horse.count(),
        ]);
        return res.status(200).json({
            status: "success",
            results: horses.length,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit)),
            },
            data: { horses },
        });
    }
    catch (error) {
        next(error);
    }
};
export const getMyHorses = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 10 } = req.query;
        const select = {
            id: true,
            name: true,
            image: true,
            lastFeedAt: true,
            feeder: {
                select: {
                    id: true,
                    feederType: true,
                    thingName: true,
                },
            },
            camera: {
                select: {
                    id: true,
                    thingName: true,
                },
            },
        };
        //  Parse pagination
        const skip = (Number(page) - 1) * Number(limit);
        //  Build filter object from query params
        const where = {
            ownerId: userId,
        };
        //  Execute queries
        const [horses, total] = await Promise.all([
            prisma.horse.findMany({
                where,
                select,
                skip,
                take: Number(limit),
                orderBy: { lastFeedAt: "desc" },
            }),
            prisma.horse.count({ where }),
        ]);
        return res.status(200).json({
            status: "success",
            results: horses.length,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit)),
            },
            data: { horses },
        });
    }
    catch (error) {
        next(error);
    }
};
export const getHorse = async (req, res, next) => {
    try {
        const { id } = req.params;
        const horse = await prisma.horse.findFirst({
            where: { id },
            select: {
                name: true,
                location: true,
                breed: true,
                age: true,
                feederId: true,
                cameraId: true,
                camera: {
                    select: {
                        thingLabel: true,
                    },
                },
                feeder: {
                    select: {
                        thingLabel: true,
                    },
                },
            },
        });
        if (!horse)
            return next(new AppError("No horse found", 404));
        return res.status(200).json({ status: "success", data: { horse } });
    }
    catch (error) {
        next(error);
    }
};
export const createHorse = async (req, res, next) => {
    try {
        const { name, age, breed, location, feederId, cameraId, ownerId } = req.body;
        const horse = await prisma.$transaction(async (tx) => {
            //  VALIDATION: Ensure feederId is a FEEDER device
            if (feederId) {
                const feederDevice = await tx.device.findUnique({
                    where: { id: feederId },
                    select: { deviceType: true },
                });
                if (!feederDevice) {
                    throw new AppError("Feeder device not found", 404);
                }
                if (feederDevice.deviceType !== "FEEDER") {
                    throw new AppError("Device must be of type FEEDER", 400);
                }
            }
            // VALIDATION: Ensure cameraId is a CAMERA device
            if (cameraId) {
                const cameraDevice = await tx.device.findUnique({
                    where: { id: cameraId },
                    select: { deviceType: true },
                });
                if (!cameraDevice) {
                    throw new AppError("Camera device not found", 404);
                }
                if (cameraDevice.deviceType !== "CAMERA") {
                    throw new AppError("Device must be of type CAMERA", 400);
                }
            }
            // Upload image to AWS (inside transaction — if it fails, everything rolls back)
            let imageUrl = null;
            if (req.file) {
                imageUrl = await uploadImageAws(req.file);
            }
            //  Create horse record
            const created = await tx.horse.create({
                data: {
                    name,
                    location,
                    image: imageUrl,
                    breed,
                    cameraId,
                    feederId,
                    age,
                    ownerId,
                },
                include: {
                    owner: { select: { id: true, name: true } },
                },
            });
            return created;
        });
        return res.status(201).json({
            status: "success",
            data: { horse },
        });
    }
    catch (error) {
        next(error);
    }
};
export const updateHorse = async (req, res, next) => {
    try {
        const { id } = req.params;
        const horse = await prisma.horse.findUnique({
            where: { id },
            select: {
                id: true,
            },
        });
        if (!horse) {
            return next(new AppError("No horse found with that ID", 404));
        }
        const { name, age, breed, location, feederId, cameraId } = req.body;
        const updatedHorse = await prisma.$transaction(async (tx) => {
            //  VALIDATION: Ensure feederId is a FEEDER device
            if (feederId) {
                const feederDevice = await tx.device.findUnique({
                    where: { id: feederId },
                    select: { deviceType: true },
                });
                if (!feederDevice) {
                    throw new AppError("Feeder device not found", 404);
                }
                if (feederDevice.deviceType !== "FEEDER") {
                    throw new AppError("Device must be of type FEEDER", 400);
                }
            }
            // VALIDATION: Ensure cameraId is a CAMERA device
            if (cameraId) {
                const cameraDevice = await tx.device.findUnique({
                    where: { id: cameraId },
                    select: { deviceType: true },
                });
                if (!cameraDevice) {
                    throw new AppError("Camera device not found", 404);
                }
                if (cameraDevice.deviceType !== "CAMERA") {
                    throw new AppError("Device must be of type CAMERA", 400);
                }
            }
            // Upload image to AWS (inside transaction — if it fails, everything rolls back)
            let imageUrl = null;
            if (req.file) {
                imageUrl = await uploadImageAws(req.file);
            }
            // Build update data — only include image if a new one was uploaded
            const updateData = {
                name,
                location,
                breed,
                cameraId,
                feederId,
                age,
            };
            //  Only overwrite image if new file uploaded
            if (imageUrl) {
                updateData.image = imageUrl;
            }
            //  Update horse record
            const updated = await tx.horse.update({
                where: {
                    id: horse.id,
                },
                data: updateData,
            });
            return updated;
        });
        return res.status(200).json({
            status: "success",
            data: { horse: updatedHorse },
        });
    }
    catch (error) {
        next(error);
    }
};
/**
 * DELETE /horses/:id?deleteDevices=true|false
 *
 * - deleteDevices=false (default): delete horse only (devices remain)
 * - deleteDevices=true: delete horse + connected feeder/camera (transaction)
 */
export const deleteHorse = async (req, res, next) => {
    try {
        const { id } = req.params;
        const deleteDevices = req.query.deleteDevices === "true";
        if (!deleteDevices) {
            const horse = await prisma.horse.findUnique({ where: { id } });
            if (!horse)
                return next(new AppError("No horse found", 404));
            await prisma.horse.delete({ where: { id } });
            return res.sendStatus(204);
        }
        await prisma.$transaction(async (tx) => {
            const horse = await tx.horse.findUnique({
                where: { id },
                select: { id: true, feederId: true, cameraId: true },
            });
            if (!horse)
                throw new AppError("No horse found", 404);
            const deviceIds = [horse.feederId, horse.cameraId].filter(Boolean);
            // Delete horse first (cascades to Feeding/ActiveFeeding)
            await tx.horse.delete({ where: { id: horse.id } });
            // Then delete connected devices (if any)
            if (deviceIds.length) {
                await tx.device.deleteMany({
                    where: { id: { in: deviceIds } },
                });
            }
        }, { isolationLevel: "Serializable", timeout: 10000 });
        return res.sendStatus(204);
    }
    catch (error) {
        next(error);
    }
};
export async function getHorsesStats(req, res, next) {
    try {
        const userId = req.user.id;
        // 1) Active feedings for ALL horses owned by this user (batch)
        const activeFeedings = await prisma.activeFeeding.findMany({
            where: {
                horse: { ownerId: userId },
            },
            select: {
                feedingId: true,
                status: true,
                horseId: true,
            },
        });
        // 2) Active stream (only one per user)
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { activeStreamHorseId: true },
        });
        let activeStream = null;
        if (user?.activeStreamHorseId) {
            const horse = await prisma.horse.findFirst({
                where: { id: user.activeStreamHorseId, ownerId: userId },
                select: {
                    id: true,
                    camera: {
                        select: {
                            streamTokenIsValid: true,
                            streamToken: true,
                        },
                    },
                },
            });
            if (!horse) {
                // if there is no active horse id then it is simply IDLE
                activeStream = null;
                //
            }
            else if (horse.camera?.streamTokenIsValid && horse.camera.streamToken) {
                // if there is a token and it is valid then it STARTED because token is generated when stream starts
                activeStream = {
                    horseId: horse.id,
                    status: "STARTED",
                    streamToken: horse.camera.streamToken,
                };
                //
            }
            else {
                // if there is no token or it is invalid then it is PENDING (waiting for stream to start)
                activeStream = {
                    horseId: horse.id,
                    status: "PENDING",
                };
                //
            }
        }
        // 3) Send response
        res.status(200).json({
            status: "success",
            data: {
                activeFeedings: activeFeedings.map((f) => ({
                    horseId: f.horseId,
                    feedingId: f.feedingId,
                    status: f.status,
                })),
                activeStream,
            },
        });
    }
    catch (error) {
        next(error);
    }
}
//test
// export async function getHorsesStats(
//   req: Request,
//   res: Response,
//   next: NextFunction,
// ) {
//   try {
//     const userId = req.user.id;
//     // 1) Get active feedings from CACHE (not DB!)
//     const activeFeedings = getActiveFeedingsByOwner(userId);
//     // 2) Active stream (still from DB)
//     const user = await prisma.user.findUnique({
//       where: { id: userId },
//       select: { activeStreamHorseId: true },
//     });
//     let activeStream: null | {
//       horseId: string;
//       status: "STARTED" | "PENDING";
//       streamToken?: string;
//     } = null;
//     if (user?.activeStreamHorseId) {
//       const horse = await prisma.horse.findFirst({
//         where: { id: user.activeStreamHorseId, ownerId: userId },
//         select: {
//           id: true,
//           camera: {
//             select: {
//               streamTokenIsValid: true,
//               streamToken: true,
//             },
//           },
//         },
//       });
//       if (!horse) {
//         activeStream = null;
//       } else if (horse.camera?.streamTokenIsValid && horse.camera.streamToken) {
//         activeStream = {
//           horseId: horse.id,
//           status: "STARTED",
//           streamToken: horse.camera.streamToken,
//         };
//       } else {
//         activeStream = {
//           horseId: horse.id,
//           status: "PENDING",
//         };
//       }
//     }
//     // 3) Send response
//     res.status(200).json({
//       status: "success",
//       data: {
//         activeFeedings: activeFeedings.map((f) => ({
//           horseId: f.horseId,
//           feedingId: f.feedingId,
//           status: f.status,
//         })),
//         activeStream,
//       },
//     });
//   } catch (error) {
//     next(error);
//   }
// }
//# sourceMappingURL=horseController.js.map