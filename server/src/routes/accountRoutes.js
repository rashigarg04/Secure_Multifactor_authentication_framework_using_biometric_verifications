import { Router } from "express";
import {
  listDevices,
  listLogs,
  mfaToggleSchema,
  passwordSchema,
  removeDevice,
  renameDevice,
  renameSchema,
  setMfa,
} from "../controllers/accountController.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();
router.use(requireAuth);

router.get("/devices", listDevices);
router.patch("/devices/:id", validate(renameSchema), renameDevice);
router.delete("/devices/:id", validate(passwordSchema), removeDevice);
router.patch("/mfa", validate(mfaToggleSchema), setMfa);
router.get("/logs", listLogs);

export default router;
