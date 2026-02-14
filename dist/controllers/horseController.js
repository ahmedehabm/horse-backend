// src/controllers/horseController.ts
import {} from "express";
import AppError from "../utils/appError.js";
import { prisma } from "../lib/prisma.js";
import APIFeatures, { parseFields } from "../utils/apiFeatures.js";
import { FeedingStatus } from "@prisma/client";
export const getAllHorses = async (req, res, next) => {
    try {
        const { unassigned } = req.query;
        // Build query with ALL features
        const features = new APIFeatures(req.query)
            .limitFields()
            .relations()
            .paginate()
            .filter();
        const prismaQuery = features.getQuery();
        const meta = features.getPaginationMeta();
        // Define DEFAULT fields (relations included)
        const defaultSelect = {
            id: true,
            name: true,
            image: true,
            breed: true,
            age: true,
            lastFeedAt: true,
            ownerId: true,
            owner: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
        };
        // MERGE: User fields + always include relations/count
        const relationsDisabled = prismaQuery.relationsDisabled || false;
        // Build select FIRST
        let finalSelect;
        if (relationsDisabled) {
            // Flat fields only
            finalSelect = {
                id: true,
                ...(prismaQuery.select || {}),
            };
        }
        else {
            // Relations enabled
            finalSelect = {
                ...defaultSelect,
                ...(prismaQuery.select || {}),
            };
        }
        // ✅ CRITICAL: Spread prismaQuery LAST to preserve where
        const finalQuery = {
            select: finalSelect,
            ...(prismaQuery || {}), // where, skip, take preserved
        };
        // Clean invalid fields
        delete finalQuery.relationsDisabled;
        delete finalQuery.relations;
        // Execute with proper relations
        const [horses, total] = await Promise.all([
            prisma.horse.findMany(finalQuery),
            prisma.horse.count({ where: prismaQuery.where }),
        ]);
        res.status(200).json({
            status: "success",
            results: horses.length,
            pagination: {
                page: meta.page,
                limit: meta.limit,
                total,
                totalPages: Math.ceil(total / meta.limit),
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
        res.status(200).json({
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
        const user = req.user;
        const { fields, relations = "true" } = req.query;
        const where = user.role === "ADMIN" ? { id } : { id, ownerId: user.id };
        const select = relations === "false"
            ? parseFields(fields || "id,name,breed,age,location,ownerId") // flat fields
            : {
                ...parseFields(fields ||
                    "id,name,breed,age,location,ownerId,defaultAmountKg,lastFeedAt"),
                owner: { select: { id: true, name: true, email: true } },
                // ✅ NEW: Include both devices
                feeder: {
                    select: {
                        id: true,
                        deviceType: true,
                        thingName: true,
                        location: true,
                        feederType: true,
                        morningTime: true,
                        dayTime: true,
                        nightTime: true,
                    },
                },
                camera: {
                    select: {
                        id: true,
                        deviceType: true,
                        thingName: true,
                        location: true,
                        streamToken: true,
                        streamTokenIsValid: true,
                    },
                },
                feedings: {
                    take: 5,
                    orderBy: { createdAt: "desc" },
                    include: {
                        device: {
                            select: {
                                id: true,
                                thingName: true,
                                deviceType: true,
                            },
                        },
                    },
                },
            };
        const horse = await prisma.horse.findFirst({ where, select });
        if (!horse)
            return next(new AppError("No horse found", 404));
        res.status(200).json({ status: "success", data: { horse } });
    }
    catch (error) {
        next(error);
    }
};
export const createHorse = async (req, res, next) => {
    try {
        const { name, age, breed, location, image, feederId, cameraId, ownerId } = req.body;
        // ✅ VALIDATION: Ensure feederId is a FEEDER device
        if (feederId) {
            const feederDevice = await prisma.device.findUnique({
                where: { id: feederId },
                select: { deviceType: true },
            });
            if (!feederDevice) {
                return next(new AppError("Feeder device not found", 404));
            }
            if (feederDevice.deviceType !== "FEEDER") {
                return next(new AppError("Device must be of type FEEDER", 400));
            }
        }
        // ✅ VALIDATION: Ensure cameraId is a CAMERA device
        if (cameraId) {
            const cameraDevice = await prisma.device.findUnique({
                where: { id: cameraId },
                select: { deviceType: true },
            });
            if (!cameraDevice) {
                return next(new AppError("Camera device not found", 404));
            }
            if (cameraDevice.deviceType !== "CAMERA") {
                return next(new AppError("Device must be of type CAMERA", 400));
            }
        }
        const horse = await prisma.horse.create({
            data: {
                name,
                location,
                image,
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
        res.status(201).json({
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
        });
        if (!horse) {
            return next(new AppError("No horse found with that ID", 404));
        }
        const { name, image, location, breed, feederId, age, cameraId } = req.body;
        // ✅ VALIDATION: If updating feederId, ensure it's a FEEDER device
        if (feederId && feederId !== horse.feederId) {
            const feederDevice = await prisma.device.findUnique({
                where: { id: feederId },
                select: { deviceType: true },
            });
            if (!feederDevice) {
                return next(new AppError("Feeder device not found", 404));
            }
            if (feederDevice.deviceType !== "FEEDER") {
                return next(new AppError("Device must be of type FEEDER", 400));
            }
        }
        // ✅ VALIDATION: If updating cameraId, ensure it's a CAMERA device
        if (cameraId && cameraId !== horse.cameraId) {
            const cameraDevice = await prisma.device.findUnique({
                where: { id: cameraId },
                select: { deviceType: true },
            });
            if (!cameraDevice) {
                return next(new AppError("Camera device not found", 404));
            }
            if (cameraDevice.deviceType !== "CAMERA") {
                return next(new AppError("Device must be of type CAMERA", 400));
            }
        }
        const updatedHorse = await prisma.horse.update({
            where: { id },
            data: {
                name,
                location,
                cameraId,
                image,
                breed,
                age,
                feederId,
                updatedAt: new Date(),
            },
            include: {
                feeder: {
                    select: {
                        id: true,
                        deviceType: true,
                        thingName: true,
                        location: true,
                        feederType: true,
                    },
                },
                camera: {
                    select: {
                        id: true,
                        deviceType: true,
                        thingName: true,
                        location: true,
                        streamToken: true,
                    },
                },
                owner: { select: { name: true } },
            },
        });
        res.status(200).json({
            status: "success",
            data: { horse: updatedHorse },
        });
    }
    catch (error) {
        next(error);
    }
};
export const deleteHorse = async (req, res, next) => {
    try {
        const { id } = req.params;
        const horse = await prisma.horse.findFirst({
            where: { id },
        });
        if (!horse) {
            return next(new AppError("No horse found with that ID", 404));
        }
        // Delete horse (cascades to feedings)
        await prisma.horse.delete({
            where: { id },
        });
        res.status(204).json({
            status: "success",
            data: null,
        });
    }
    catch (error) {
        next(error);
    }
};
// MIDDLEWARE
export const restrictToHorseOwner = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const horse = await prisma.horse.findFirst({
            where: { id, ownerId: userId },
        });
        if (!horse) {
            return next(new AppError("You do not have permission to access this horse", 403));
        }
        req.horse = horse;
        next();
    }
    catch (error) {
        next(error);
    }
};
export const bulkAssignHorsesToUser = async (req, res, next) => {
    try {
        const { userId } = req.body;
        const horseIds = req.body.horseIds;
        // Validate inputs
        if (!userId || !Array.isArray(horseIds) || horseIds.length === 0) {
            return res.status(400).json({
                status: "error",
                message: "userId and horseIds array are required",
            });
        }
        // Verify user exists
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, role: true },
        });
        if (!user) {
            return res.status(404).json({
                status: "error",
                message: "User not found",
            });
        }
        // Check horses exist and are unassigned using transaction
        const horsesToUpdate = await prisma.$transaction(async (tx) => {
            const unassignedHorses = await tx.horse.findMany({
                where: {
                    id: { in: horseIds },
                    ownerId: null, // Only unassigned horses
                },
                select: {
                    id: true,
                    name: true,
                    ownerId: true,
                },
            });
            // Validate all requested horses are unassigned and exist
            const foundHorseIds = unassignedHorses.map((h) => h.id);
            const missingHorses = horseIds.filter((id) => !foundHorseIds.includes(id));
            const alreadyAssigned = horseIds.filter((id) => unassignedHorses.find((h) => h.id === id)?.ownerId !== null);
            if (missingHorses.length > 0) {
                throw new Error(`Horses not found: ${missingHorses.join(", ")}`);
            }
            if (alreadyAssigned.length > 0) {
                throw new Error(`Horses already assigned: ${alreadyAssigned.join(", ")}`);
            }
            return unassignedHorses;
        });
        // Bulk update all horses to same user
        const updatedHorses = await prisma.horse.updateMany({
            where: {
                id: { in: horseIds },
            },
            data: {
                ownerId: userId,
            },
        });
        // Fetch updated horses with owner info
        const horsesWithOwner = await prisma.horse.findMany({
            where: { id: { in: horseIds } },
            include: {
                owner: { select: { id: true, name: true, username: true } },
                feeder: true,
            },
        });
        res.status(200).json({
            status: "success",
            message: `Successfully assigned ${horsesToUpdate.length} horses to ${user.name}`,
            data: {
                horses: horsesWithOwner,
                count: updatedHorses.count,
            },
        });
    }
    catch (error) {
        next(error);
    }
};
export const getFeedingActiveStatus = async (req, res, next) => {
    try {
        const { horseId } = req.params;
        // Find the most recent feeding that's not completed or failed
        const activeFeeding = await prisma.feeding.findFirst({
            where: {
                horseId,
                status: {
                    in: [
                        FeedingStatus.PENDING,
                        FeedingStatus.STARTED,
                        FeedingStatus.RUNNING,
                    ],
                },
            },
            orderBy: {
                createdAt: "desc",
            },
            include: {
                horse: {
                    include: {
                        feeder: true,
                    },
                },
            },
        });
        // No active feeding found
        if (!activeFeeding) {
            throw new AppError("No active feeding found for this horse", 404);
        }
        // Return feeding status in the same format as Socket.IO events
        return res.json({
            horseId: activeFeeding.horseId,
            feedingId: activeFeeding.id,
            status: activeFeeding.status,
            deviceName: activeFeeding.horse.feeder?.thingName || "Unknown",
        });
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
        //this means that stream is started already
        let activeStream = null;
        if (user?.activeStreamHorseId) {
            const horse = await prisma.horse.findFirst({
                where: { id: user.activeStreamHorseId, ownerId: userId },
                select: {
                    id: true,
                    camera: { select: { streamTokenIsValid: true, streamToken: true } },
                },
            });
            if (!horse) {
                // await prisma.user.update({
                //   where: { id: userId },
                //   data: { activeStreamHorseId: null },
                // });
                activeStream = null;
                //
            }
            else if (horse.camera?.streamTokenIsValid && horse.camera.streamToken) {
                activeStream = { horseId: horse.id, status: "STARTED" };
                //
            }
            else {
                activeStream = { horseId: horse.id, status: "PENDING" };
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
//# sourceMappingURL=horseController.js.map