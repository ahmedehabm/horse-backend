// src/routes/deviceRoutes.ts
import express from "express";
import { restrictTo } from "../controllers/authController.js";
import {
  createDevice,
  getAllDevices,
  getDeviceOptions,
  getMyFeeders,
  getMyFeeder,
  updateMyFeeder,
} from "../controllers/deviceController.js";

import { validateRequest } from "../lib/validateRequest.js";
import { createDeviceSchema, updateFeederSchema } from "../lib/validators.js";

const router = express.Router();

// 1) options (admin)
router.get("/options", restrictTo("ADMIN"), getDeviceOptions);

// 2) my feeders list (USER only; function blocks ADMIN)
router.get("/my/feeders", getMyFeeders);

// 3) my single feeder (USER only; controller blocks ADMIN)
router.get("/my/feeders/:id", getMyFeeder);

// 4) update my feeder (USER only; controller blocks ADMIN)
router.patch(
  "/my/feeders/:id",
  validateRequest(updateFeederSchema),
  updateMyFeeder,
);

// 5) all devices table (admin)
router.get("/", restrictTo("ADMIN"), getAllDevices);

// 6) create a device feeder/camera (admin)
router.post(
  "/",
  restrictTo("ADMIN"),
  validateRequest(createDeviceSchema),
  createDevice,
);

export default router;
