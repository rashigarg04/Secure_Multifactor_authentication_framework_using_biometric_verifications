import { Router } from "express";
import { passwordSchema } from "../controllers/accountController.js";
import { enroll, remove, status, verify } from "../controllers/retinaController.js";
import { requireAuth } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { retinaUpload } from "../middleware/upload.js";
import { validate } from "../middleware/validate.js";

const router = Router();

router.get("/", requireAuth, status);
router.post("/enroll", requireAuth, authLimiter, retinaUpload, enroll);
router.delete("/", requireAuth, validate(passwordSchema), remove);

// Public: runs after the password step, before a full session exists (needs the pending cookie)
router.post("/verify", authLimiter, retinaUpload, verify);

export default router;
