// src/routes/deviceRoutes.ts
import express from "express";
import { restrictTo } from "../controllers/authController.js";
import {
  createDevice,
  getAllDevices,
  getDeviceOptions,
  getMyFeeders,
} from "../controllers/deviceController.js";
import { validateRequest } from "../lib/validateRequest.js";
import { createDeviceSchema } from "../lib/validators.js";

const router = express.Router();

// 1) options (admin)
router.get("/options", restrictTo("ADMIN"), getDeviceOptions);

// 2) my feeders (USER only; function blocks ADMIN)
router.get("/my/feeders", getMyFeeders);

// 3) all devices table (admin)
router.get("/", restrictTo("ADMIN"), getAllDevices);

// 4) create a device feeder/camera
router.post(
  "/",
  restrictTo("ADMIN"),
  validateRequest(createDeviceSchema),
  createDevice,
);

export default router;
