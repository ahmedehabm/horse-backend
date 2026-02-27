// src/routes/deviceRoutes.ts
import express from "express";
import { restrictTo } from "../controllers/authController.js";
import { createDevice, getAllDevices, getDeviceOptions, getMyFeeders, getMyFeeder, updateMyFeeder, forceUnassignDevice, getDevice, updateDevice, deleteDevice, } from "../controllers/deviceController.js";
import { validateRequest } from "../lib/validateRequest.js";
import { createDeviceSchema, updateDeviceSchema, updateFeederSchema, } from "../lib/validators.js";
const router = express.Router();
// 1) options (admin) to create/update horses to assign them to the feeders/cameras
router.get("/options", restrictTo("ADMIN"), getDeviceOptions);
// 2) my feeders list (USER only; function blocks ADMIN)
router.get("/my/feeders", getMyFeeders);
// 3) my single feeder (USER only; controller blocks ADMIN)
router.get("/my/feeders/:id", getMyFeeder);
// 4) update my feeder (USER only; controller blocks ADMIN)
router.patch("/my/feeders/:id", validateRequest(updateFeederSchema), updateMyFeeder);
// 5) all devices table (admin)
router.get("/", restrictTo("ADMIN"), getAllDevices);
// 6) get device for edit (admin)
router.get("/:id", restrictTo("ADMIN"), getDevice);
// 7) update device (admin)
router.patch("/:id", restrictTo("ADMIN"), validateRequest(updateDeviceSchema), updateDevice);
// 8) delete device (admin)
router.delete("/:id", restrictTo("ADMIN"), deleteDevice);
// 9) create a device feeder/camera (admin)
router.post("/", restrictTo("ADMIN"), validateRequest(createDeviceSchema), createDevice);
// 10) force unassign device from horse (admin only)
router.patch("/unassign/:id", restrictTo("ADMIN"), forceUnassignDevice);
export default router;
//# sourceMappingURL=deviceRoutes.js.map