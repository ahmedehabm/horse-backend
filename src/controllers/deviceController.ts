// src/controllers/deviceController.ts
import type { Request, Response, NextFunction } from "express";
import { Prisma, DeviceType, FeederType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import AppError from "../utils/appError.js";

const toBool = (v: unknown) => String(v).toLowerCase() === "true";
const toInt = (v: unknown, fallback: number) => {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/**
 * 1) GET /api/v1/devices/options?type=FEEDER|CAMERA&unassigned=true
 * Minimal select for select-options (id + label + thingName)
 */
export const getDeviceOptions = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const type = String(req.query.type || "").toUpperCase();

    if (type !== "FEEDER" && type !== "CAMERA") {
      return res.status(400).json({
        status: "fail",
        message: "Query param 'type' must be FEEDER or CAMERA",
      });
    }

    const unassigned = toBool(req.query.unassigned);

    const where: Prisma.DeviceWhereInput = {
      deviceType: type as DeviceType,
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
  } catch (err) {
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
export const getMyFeeders = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
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

    const where: Prisma.DeviceWhereInput = {
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
          horsesAsFeeder: {
            take: 1,
            select: { id: true, name: true },
          },
        },
      }),
      prisma.device.count({ where }),
    ]);

    const formatted = feeders.map((f) => ({
      ...f,
      horse: f.horsesAsFeeder[0] ?? null,
      horsesAsFeeder: undefined,
    }));

    return res.status(200).json({
      status: "success",
      results: formatted.length,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      data: { feeders: formatted },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 3) GET /api/v1/devices?type=FEEDER|CAMERA&page=1&limit=20
 * Admin devices table with pagination + optional filters.
 */
export const getAllDevices = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
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
        message:
          "Query param 'type' must be FEEDER, CAMERA, ALL, or omitted for all devices",
      });
    }

    const [devices, total] = await prisma.$transaction([
      prisma.device.findMany({
        where: type ? { deviceType: type as "CAMERA" | "FEEDER" } : {},
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
        where: type ? { deviceType: type as "CAMERA" | "FEEDER" } : {},
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
  } catch (err) {
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
export const createDevice = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      thingLabel,
      deviceType,
      location,
      feederType,
      morningTime,
      dayTime,
      nightTime,
    } = req.body;

    const feederData =
      deviceType === "FEEDER"
        ? {
            feederType: (feederType ?? "MANUAL") as FeederType,
            morningTime: morningTime ?? null,
            dayTime: dayTime ?? null,
            nightTime: nightTime ?? null,
          }
        : {
            feederType: FeederType.MANUAL,
            morningTime: null,
            dayTime: null,
            nightTime: null,
          };

    // Transaction: Create device + Get AWS certificates
    const result = await prisma.$transaction(async (tx) => {
      // 1) Create device in database
      const device = await tx.device.create({
        data: {
          thingLabel,
          deviceType: deviceType as DeviceType,
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

      // 2) Create AWS IoT Thing and get certificates
      const awsResponse = (await fetch(
        `${process.env.AWS_LAMBDA_URL}/provision-device`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            thingName: device.thingName,
            deviceType: device.deviceType,
          }),
        },
      )) as any;

      if (!awsResponse.ok) {
        const errorText = await awsResponse.text();
        throw new AppError(
          `AWS device creation failed: ${errorText}`,
          awsResponse.status === 409 ? 409 : 502,
        );
      }

      const awsData = await awsResponse.json();

      if (!awsData.certificatePem || !awsData.privateKey) {
        throw new AppError("AWS did not return required certificates", 502);
      }

      return {
        device,
        certificate: awsData.certificatePem,
        privateKey: awsData.privateKey,
      };
    });

    // Return device info + certificates for download
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
  } catch (err: any) {
    next(err);
  }
};
