// src/controllers/horseController.ts
import { type NextFunction, type Request, type Response } from "express";
import multer from "multer";

import AppError from "../utils/appError.js";

import { prisma } from "../lib/prisma.js";

import { parseFields } from "../utils/apiFeatures.js";
import { type Prisma } from "@prisma/client";
import { uploadImageFs } from "../lib/uploadImageFs.js";

const storage = multer.memoryStorage();

const fileFilter = (
  _req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
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

export const getAllHorses = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    // Define DEFAULT fields (relations included)
    const select: Prisma.HorseSelect = {
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
  } catch (error) {
    next(error);
  }
};

export const getMyHorses = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user!.id;
    const { page = 1, limit = 10 } = req.query;

    const select: Prisma.HorseSelect = {
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
    const where: Prisma.HorseWhereInput = {
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
  } catch (error) {
    next(error);
  }
};

export const getHorse = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params as { id: string };
    const user = req.user!;
    const { fields, relations = "true" } = req.query;

    const where = user.role === "ADMIN" ? { id } : { id, ownerId: user.id };

    const select =
      relations === "false"
        ? parseFields(fields || "id,name,breed,age,location,ownerId") // flat fields
        : {
            ...parseFields(
              fields ||
                "id,name,breed,age,location,ownerId,defaultAmountKg,lastFeedAt",
            ),
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
              orderBy: { createdAt: "desc" } as const,
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

    if (!horse) return next(new AppError("No horse found", 404));

    return res.status(200).json({ status: "success", data: { horse } });
  } catch (error) {
    next(error);
  }
};

export const createHorse = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { name, age, breed, location, feederId, cameraId, ownerId } =
      req.body;

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
      let imageUrl: string | undefined;

      if (req.file) {
        imageUrl = await uploadImageFs(req.file);
      }

      //  Create horse record
      const created = await tx.horse.create({
        data: {
          name,
          location,
          image: imageUrl!,
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
  } catch (error) {
    next(error);
  }
};

export const updateHorse = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params as { id: string };

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
  } catch (error) {
    next(error);
  }
};

export const deleteHorse = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params as { id: string };

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
  } catch (error) {
    next(error);
  }
};

export async function getHorsesStats(
  req: Request,
  res: Response,
  next: NextFunction,
) {
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

    let activeStream: null | {
      horseId: string;
      status: "STARTED" | "PENDING";
      streamToken?: string;
    } = null;

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
      } else if (horse.camera?.streamTokenIsValid && horse.camera.streamToken) {
        // if there is a token and it is valid then it STARTED because token is generated when stream starts

        activeStream = {
          horseId: horse.id,
          status: "STARTED",
          streamToken: horse.camera.streamToken,
        };
        //
      } else {
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
  } catch (error) {
    next(error);
  }
}
