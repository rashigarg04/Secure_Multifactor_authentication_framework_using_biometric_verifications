import { Router } from "express";
import {
  login,
  loginSchema,
  logout,
  me,
  register,
  registerSchema,
} from "../controllers/authController.js";
import {
  authenticationOptionsSchema,
  generateAuthenticationOptionsHandler,
  generateRegistrationOptionsHandler,
  registrationOptionsSchema,
  verifyAuthenticationHandler,
  verifyAuthenticationSchema,
  verifyRegistrationHandler,
  verifyRegistrationSchema,
} from "../controllers/webauthnController.js";
import { requireAuth } from "../middleware/auth.js";
import { authLimiter, loginLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";

const router = Router();

// Primary auth (password)
router.post("/register", authLimiter, validate(registerSchema), register);
router.post("/login", loginLimiter, validate(loginSchema), login);
router.post("/logout", logout);
router.get("/me", requireAuth, me);

// WebAuthn registration (needs a full session)
router.post(
  "/generate-registration-options",
  requireAuth,
  authLimiter,
  validate(registrationOptionsSchema),
  generateRegistrationOptionsHandler
);
router.post(
  "/verify-registration",
  requireAuth,
  authLimiter,
  validate(verifyRegistrationSchema),
  verifyRegistrationHandler
);

// WebAuthn authentication (public: runs before a full session exists)
router.post(
  "/generate-authentication-options",
  authLimiter,
  validate(authenticationOptionsSchema),
  generateAuthenticationOptionsHandler
);
router.post(
  "/verify-authentication",
  authLimiter,
  validate(verifyAuthenticationSchema),
  verifyAuthenticationHandler
);

export default router;