// src/routes/horseRoutes.ts
import express from "express";
import {
  getAllHorses,
  getMyHorses,
  getHorse,
  createHorse,
  updateHorse,
  deleteHorse,
  getHorsesStats,
  uploadImage,
} from "../controllers/horseController.js";
import { restrictTo } from "../controllers/authController.js";
import { validateRequest } from "../lib/validateRequest.js";
import { createHorseSchema, updateHorseSchema } from "../lib/validators.js";

const router = express.Router();

// 1. USER ROUTES (normal users)
/**
 * GET /api/v1/horses/me     → My horses only
 * POST /api/v1/horses/me    → Create my horse
 */
router.route("/me").get(getMyHorses); // Any logged-in user

// router.route("/:horseId/feeding/active").get(getFeedingActiveStatus);

router.route("/stats").get(getHorsesStats);

// 2. ADMIN ROUTES (admin only)
/**
 * GET /api/v1/horses        → All horses (admin only)
 * POST /api/v1/horses/me    → Create horse (admin only)
 */
router
  .route("/")

  .get(restrictTo("ADMIN"), getAllHorses)

  .post(
    restrictTo("ADMIN"),
    uploadImage,
    validateRequest(createHorseSchema),
    createHorse,
  ); // Admin only

// router.route("/unassigned").get(getMyHorses);

// 3. HORSE-SPECIFIC ROUTES (owner or admin)
/**
 * GET  /api/v1/horses/:id   → View horse (admin)
 * PATCH /api/v1/horses/:id  → Update horse (admin)
 * DELETE /api/v1/horses/:id → Delete horse (admin only)
 */

router
  .route("/:id")

  .get(restrictTo("ADMIN"), getHorse) // Admin only

  .patch(
    restrictTo("ADMIN"),
    uploadImage,
    validateRequest(updateHorseSchema),
    updateHorse,
  ) // Admin only

  .delete(restrictTo("ADMIN"), deleteHorse); // Admin only

export default router;
