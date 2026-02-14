// src/routes/authRoutes.ts
import express from "express";
import {
  signup,
  login,
  protect,
  updatePassword,
  logout,
  getMe,
  restrictTo,
} from "../controllers/authController.js";
import { validateRequest } from "../lib/validateRequest.js";
import {
  updatePasswordSchema,
  userLoginSchema,
  userSignupSchema,
} from "../lib/validators.js";

const router = express.Router();

// PUBLIC ROUTES FIRST (no protect)
router.post("/login", validateRequest(userLoginSchema), login);

// PROTECTED ROUTES LAST (with protect)
router.post(
  "/signup",
  protect,
  restrictTo("ADMIN"),
  validateRequest(userSignupSchema),
  signup,
);
router.get("/me", protect, getMe);
router.get("/logout", protect, logout);
router.post(
  "/updateMyPassword",
  protect,
  validateRequest(updatePasswordSchema),
  updatePassword,
);

export default router;
