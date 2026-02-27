import { Prisma, DeviceType, FeederType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import AppError from "../utils/appError.js";
import { provisionAwsDevice } from "../lib/awsUpload.js";
const toBool = (v) => String(v).toLowerCase() === "true";
const toInt = (v, fallback) => {
    const n = parseInt(String(v ?? ""), 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
};
const normalizeTime = (t) => (t === "" ? null : t);
/**
 * 1) GET /api/v1/devices/options?type=FEEDER|CAMERA&unassigned=true
 * Minimal select for select-options (id + label + thingName)
 */
export const getDeviceOptions = async (req, res, next) => {
    try {
        const type = String(req.query.type || "").toUpperCase();
        if (type !== "FEEDER" && type !== "CAMERA") {
            return res.status(400).json({
                status: "fail",
                message: "Query param 'type' must be FEEDER or CAMERA",
            });
        }
        const unassigned = toBool(req.query.unassigned);
        const where = {
            deviceType: type,
            ...(unassigned
                ? type === "FEEDER"
                    ? { horsesAsFeeder: { none: {} } }
                    : { horsesAsCamera: { none: {} } }
                : {}),
        };
        const devices = await prisma.device.findMany({
            where,
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                thingLabel: true,
            },
        });
        return res.status(200).json({
            status: "success",
            results: devices.length,
            data: { devices },
        });
    }
    catch (err) {
        next(err);
    }
};
/**
 * 2) GET /api/v1/devices/my/feeders?page=1&limit=10
 *
 * If req.user.role === "ADMIN" => this route is not meant for him (403)
 * else => use req.user.id and return feeders assigned to THIS user's horses
 * (includes horse name so user can edit morning/day/night times)
 */
export const getMyFeeders = async (req, res, next) => {
    try {
        const user = req.user;
        if (user.role === "ADMIN") {
            return res.status(403).json({
                status: "fail",
                message: "Admins should not use this route",
            });
        }
        const page = toInt(req.query.page, 1);
        const limit = toInt(req.query.limit, 10);
        const skip = (page - 1) * limit;
        const where = {
            deviceType: DeviceType.FEEDER,
            horsesAsFeeder: {
                some: { ownerId: user.id },
            },
        };
        const [feeders, total] = await prisma.$transaction([
            prisma.device.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    thingLabel: true,
                    feederType: true,
                    horsesAsFeeder: {
                        take: 1,
                        select: { id: true, name: true },
                    },
                },
            }),
            prisma.device.count({ where }),
        ]);
        return res.status(200).json({
            status: "success",
            results: feeders.length,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
            data: { feeders },
        });
    }
    catch (err) {
        next(err);
    }
};
export const getMyFeeder = async (req, res, next) => {
    try {
        const user = req.user;
        const { id } = req.params;
        if (user.role === "ADMIN") {
            return res.status(403).json({
                status: "fail",
                message: "Admins should not use this route",
            });
        }
        const where = {
            id,
            deviceType: DeviceType.FEEDER,
            // ensure this feeder belongs to this user (via horse ownership)
            horsesAsFeeder: {
                some: { ownerId: user.id },
            },
        };
        const feeder = await prisma.device.findFirst({
            where,
            select: {
                feederType: true,
                scheduledAmountKg: true,
                morningTime: true,
                dayTime: true,
                nightTime: true,
            },
        });
        if (!feeder) {
            return next(new AppError("Feeder not found", 404));
        }
        return res.status(200).json({
            status: "success",
            data: { feeder },
        });
    }
    catch (err) {
        next(err);
    }
};
export const updateMyFeeder = async (req, res, next) => {
    try {
        const user = req.user;
        const { id } = req.params;
        if (user.role === "ADMIN") {
            return res.status(403).json({
                status: "fail",
                message: "Admins should not use this route",
            });
        }
        // 1) Make sure this feeder belongs to this user (through owned horse)
        const ownedFeeder = await prisma.device.findFirst({
            where: {
                id,
                deviceType: DeviceType.FEEDER,
                horsesAsFeeder: { some: { ownerId: user.id } },
            },
            select: { id: true },
        });
        if (!ownedFeeder)
            return next(new AppError("Feeder not found", 404));
        // 2) extract required fields
        const body = req.body;
        // 3) Build prisma update object
        const updateData = {
            feederType: body.feederType,
            scheduledAmountKg: body.scheduledAmountKg ?? null,
            morningTime: body.morningTime ?? null,
            dayTime: body.dayTime ?? null,
            nightTime: body.nightTime ?? null,
        };
        if (body.feederType === "MANUAL") {
            updateData.scheduledAmountKg = null;
            updateData.morningTime = null;
            updateData.dayTime = null;
            updateData.nightTime = null;
        }
        // 4) Update
        const updated = await prisma.device.update({
            where: { id: ownedFeeder.id },
            data: updateData,
            select: {
                feederType: true,
                scheduledAmountKg: true,
                morningTime: true,
                dayTime: true,
                nightTime: true,
            },
        });
        return res.status(200).json({
            status: "success",
            data: { feeder: updated },
        });
    }
    catch (err) {
        next(err);
    }
};
/**
 * 3) GET /api/v1/devices?type=FEEDER|CAMERA&page=1&limit=20
 * Admin devices table with pagination + optional filters.
 */
export const getAllDevices = async (req, res, next) => {
    try {
        const page = toInt(req.query.page, 1);
        const limit = toInt(req.query.limit, 20);
        const skip = (page - 1) * limit;
        const typeRaw = String(req.query.type || "").toUpperCase();
        // Normalize "ALL" to empty string for easier handling
        const type = typeRaw === "ALL" ? "" : typeRaw;
        // Validate type - allow empty string or "ALL" for all devices
        if (type && type !== "FEEDER" && type !== "CAMERA") {
            return res.status(400).json({
                status: "fail",
                message: "Query param 'type' must be FEEDER, CAMERA",
            });
        }
        const [devices, total] = await prisma.$transaction([
            prisma.device.findMany({
                where: type ? { deviceType: type } : {},
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    thingLabel: true,
                    deviceType: true,
                    ...(type === "CAMERA" && {
                        horsesAsCamera: {
                            select: { name: true },
                        },
                    }),
                    ...(type === "FEEDER" && {
                        horsesAsFeeder: {
                            select: { name: true },
                        },
                    }),
                    ...(!type && {
                        horsesAsCamera: {
                            select: { name: true },
                        },
                        horsesAsFeeder: {
                            select: { name: true },
                        },
                    }),
                },
            }),
            prisma.device.count({
                where: type ? { deviceType: type } : {},
            }),
        ]);
        return res.status(200).json({
            status: "success",
            results: devices.length,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
            data: { devices },
        });
    }
    catch (err) {
        next(err);
    }
};
export const getDevice = async (req, res, next) => {
    try {
        const { id } = req.params;
        const device = await prisma.device.findUnique({
            where: { id },
            select: {
                id: true,
                thingLabel: true,
                thingName: true,
                location: true,
                deviceType: true,
                feederType: true,
                scheduledAmountKg: true,
                morningTime: true,
                dayTime: true,
                nightTime: true,
            },
        });
        if (!device) {
            return next(new AppError("Device not found", 404));
        }
        res.status(200).json({
            status: "success",
            data: { device },
        });
    }
    catch (err) {
        next(err);
    }
};
/**
 * Patch /api/v1/devices/:id
 * ADMIN ONLY
 * Body:
 *  - thingLabel (unique)
 *  - deviceType: CAMERA | FEEDER
 *  - location
 *  - feederType/morningTime/dayTime/nightTime (only for FEEDER)
 *
 */
export const updateDevice = async (req, res, next) => {
    try {
        const { id } = req.params;
        // 1) Find the device to know its type
        const device = await prisma.device.findUnique({
            where: { id },
            select: { id: true, deviceType: true },
        });
        if (!device) {
            return next(new AppError("Device not found", 404));
        }
        // 2) Build update object based on device type
        let updateData = {};
        if (device.deviceType === "CAMERA") {
            const body = req.body;
            updateData = {
                ...(body.thingLabel !== undefined && { thingLabel: body.thingLabel }),
                ...(body.location !== undefined && { location: body.location }),
            };
        }
        if (device.deviceType === "FEEDER") {
            const body = req.body;
            updateData = {
                ...(body.thingLabel !== undefined && { thingLabel: body.thingLabel }),
                ...(body.location !== undefined && { location: body.location }),
                ...(body.feederType !== undefined && { feederType: body.feederType }),
            };
            // Only update schedule fields if feederType is provided
            if (body.feederType === "MANUAL") {
                updateData.scheduledAmountKg = null;
                updateData.morningTime = null;
                updateData.dayTime = null;
                updateData.nightTime = null;
            }
            if (body.feederType === "SCHEDULED") {
                updateData.scheduledAmountKg = body.scheduledAmountKg ?? null;
                updateData.morningTime = body.morningTime ?? null;
                updateData.dayTime = body.dayTime ?? null;
                updateData.nightTime = body.nightTime ?? null;
            }
        }
        // 3) Update
        const updated = await prisma.device.update({
            where: { id: device.id },
            data: updateData,
            select: {
                id: true,
                thingLabel: true,
                thingName: true,
                location: true,
                deviceType: true,
                feederType: true,
                scheduledAmountKg: true,
                morningTime: true,
                dayTime: true,
                nightTime: true,
            },
        });
        return res.status(200).json({
            status: "success",
            data: { device: updated },
        });
    }
    catch (err) {
        next(err);
    }
};
/**
 * POST /api/v1/devices
 * Body:
 *  - thingLabel (unique)
 *  - deviceType: CAMERA | FEEDER
 *  - location
 *  - feederType/morningTime/dayTime/nightTime (only for FEEDER)
 *
 */
export const createDevice = async (req, res, next) => {
    try {
        const { thingLabel, deviceType, location, feederType, morningTime, dayTime, nightTime, scheduledAmountKg, } = req.body;
        const feederData = deviceType === "FEEDER"
            ? {
                feederType: (feederType ?? "MANUAL"),
                morningTime: morningTime ?? null,
                dayTime: dayTime ?? null,
                nightTime: nightTime ?? null,
                scheduledAmountKg: scheduledAmountKg ?? null,
            }
            : {
                feederType: FeederType.MANUAL,
                morningTime: null,
                dayTime: null,
                nightTime: null,
                scheduledAmountKg: null,
            };
        const result = await prisma.$transaction(async (tx) => {
            const device = await tx.device.create({
                data: {
                    thingLabel,
                    deviceType: deviceType,
                    location,
                    ...feederData,
                },
                select: {
                    id: true,
                    thingLabel: true,
                    thingName: true,
                    deviceType: true,
                },
            });
            const { certificatePem, privateKey } = await provisionAwsDevice(device.thingName, device.deviceType);
            return {
                device,
                certificate: certificatePem,
                privateKey,
            };
        });
        return res.status(201).json({
            status: "success",
            data: {
                device: result.device,
                credentials: {
                    certificate: result.certificate,
                    privateKey: result.privateKey,
                },
            },
        });
    }
    catch (err) {
        next(err);
    }
};
// PATCH /api/devices/unassign/:id
export const forceUnassignDevice = async (req, res, next) => {
    try {
        const { id } = req.params;
        // 1) Find the device
        const device = await prisma.device.findUnique({
            where: { id },
            select: {
                id: true,
                deviceType: true,
                thingLabel: true,
                horsesAsFeeder: {
                    select: { id: true, name: true },
                },
                horsesAsCamera: {
                    select: { id: true, name: true },
                },
            },
        });
        if (!device) {
            return next(new AppError("Device not found", 404));
        }
        // 2) Check if device is assigned
        const isFeederAssigned = device.horsesAsFeeder.length > 0;
        const isCameraAssigned = device.horsesAsCamera.length > 0;
        if (!isFeederAssigned && !isCameraAssigned) {
            return res.status(200).json({
                status: "success",
                message: "Device is already unassigned",
                data: { device },
            });
        }
        // 3) Unassign the device from the horse
        if (device.deviceType === "FEEDER" && isFeederAssigned) {
            const horse = device.horsesAsFeeder[0];
            await prisma.horse.update({
                where: { id: horse.id },
                data: { feederId: null },
            });
            return res.status(200).json({
                status: "success",
                message: `Feeder unassigned from ${horse.name}`,
                data: {
                    device: {
                        id: device.id,
                        thingLabel: device.thingLabel,
                        deviceType: device.deviceType,
                    },
                    unassignedFrom: {
                        horseId: horse.id,
                        horseName: horse.name,
                    },
                },
            });
        }
        if (device.deviceType === "CAMERA" && isCameraAssigned) {
            const horse = device.horsesAsCamera[0];
            await prisma.horse.update({
                where: { id: horse.id },
                data: { cameraId: null },
            });
            return res.status(200).json({
                status: "success",
                message: `Camera unassigned from ${horse.name}`,
                data: {
                    device: {
                        id: device.id,
                        thingLabel: device.thingLabel,
                        deviceType: device.deviceType,
                    },
                    unassignedFrom: {
                        horseId: horse.id,
                        horseName: horse.name,
                    },
                },
            });
        }
        // Should not reach here, but just in case
        return res.status(200).json({
            status: "success",
            message: "Device unassigned successfully",
            data: { device },
        });
    }
    catch (err) {
        next(err);
    }
};
export const deleteDevice = async (req, res, next) => {
    try {
        const { id } = req.params;
        const device = await prisma.device.findFirst({
            where: { id },
        });
        if (!device) {
            return next(new AppError("No device found", 404));
        }
        // Delete device
        await prisma.device.delete({
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
//# sourceMappingURL=deviceController.js.map