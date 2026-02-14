// src/routes/deviceRoutes.ts
import express from "express";
import { getAllUsers, restrictTo } from "../controllers/authController.js";
const router = express.Router();
router.route("/").get(restrictTo("ADMIN"), getAllUsers);
export default router;
//# sourceMappingURL=userRoutes.js.map