// src/controllers/horseController.ts
import { type NextFunction, type Request, type Response } from "express";

import AppError from "../utils/appError.js";
import { prisma } from "../app.js";

import APIFeatures, { parseFields } from "../utils/apiFeatures.js";
import type { Prisma } from "@prisma/client";

export const getAllHorses = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
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
      location: true,
      defaultAmountKg: true,
      lastFeedAt: true,
      ownerId: true,
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      // ✅ NEW: Include both feeder and camera devices
      // feeder: {
      //   select: {
      //     id: true,
      //     deviceType: true,
      //     thingName: true,
      //     location: true,
      //     feederType: true,
      //     morningTime: true,
      //     dayTime: true,
      //     nightTime: true,
      //   },
      // },
      // camera: {
      //   select: {
      //     id: true,
      //     deviceType: true,
      //     thingName: true,
      //     location: true,
      //     streamToken: true,
      //     streamTokenIsValid: true,
      //   },
      // },
    };

    // MERGE: User fields + always include relations/count
    const relationsDisabled = prismaQuery.relationsDisabled || false;

    // Build select FIRST
    let finalSelect: any;
    if (relationsDisabled) {
      // Flat fields only
      finalSelect = {
        id: true,
        ...(prismaQuery.select || {}),
      };
    } else {
      // Relations enabled
      finalSelect = {
        ...defaultSelect,
        ...(prismaQuery.select || {}),
      };
    }

    // ✅ CRITICAL: Spread prismaQuery LAST to preserve where
    const finalQuery: any = {
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
          feederType: true,
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

    res.status(200).json({ status: "success", data: { horse } });
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
    const {
      name,
      image,
      location,
      breed,
      defaultAmountKg,
      feederId,
      age,
      cameraId,
    } = req.body;

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
        defaultAmountKg: defaultAmountKg || 2.5,
        age,
      },
      include: {
        owner: { select: { id: true, name: true } },
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
      },
    });

    res.status(201).json({
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

    const {
      name,
      image,
      location,
      breed,
      defaultAmountKg,
      feederId,
      age,
      cameraId,
    } = req.body;

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
        defaultAmountKg,
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
// MIDDLEWARE
export const restrictToHorseOwner = async (
  req: any,
  res: any,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const horse = await prisma.horse.findFirst({
      where: { id, ownerId: userId },
    });

    if (!horse) {
      return next(
        new AppError("You do not have permission to access this horse", 403),
      );
    }

    req.horse = horse;
    next();
  } catch (error) {
    next(error);
  }
};

export const bulkAssignHorsesToUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = req.body;
    const horseIds = req.body.horseIds as string[];

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
      const missingHorses = horseIds.filter(
        (id) => !foundHorseIds.includes(id),
      );
      const alreadyAssigned = horseIds.filter(
        (id) => unassignedHorses.find((h) => h.id === id)?.ownerId !== null,
      );

      if (missingHorses.length > 0) {
        throw new Error(`Horses not found: ${missingHorses.join(", ")}`);
      }

      if (alreadyAssigned.length > 0) {
        throw new Error(
          `Horses already assigned: ${alreadyAssigned.join(", ")}`,
        );
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
        owner: { select: { id: true, name: true, email: true } },
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
  } catch (error: any) {
    res.status(400).json({
      status: "error",
      message: error.message || "Failed to assign horses",
    });
  }
};
