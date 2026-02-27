// src/routes/deviceRoutes.ts
import express from "express";
import { deleteUser, getAllUsers, restrictTo, } from "../controllers/authController.js";
const router = express.Router();
router.route("/").get(restrictTo("ADMIN"), getAllUsers);
router.route("/:id").delete(restrictTo("ADMIN"), deleteUser);
export default router;
//# sourceMappingURL=userRoutes.js.map