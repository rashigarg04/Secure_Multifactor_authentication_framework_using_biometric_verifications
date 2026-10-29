import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

const base = { standardHeaders: "draft-8", legacyHeaders: false };

export const apiLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 600,
  message: { error: "Too many requests. Please slow down." },
});

// Password login: only FAILED attempts count toward the limit.
export const loginLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: env.isProd ? 10 : 100,
  skipSuccessfulRequests: true,
  message: { error: "Too many login attempts. Try again later." },
});

// Registration and WebAuthn ceremonies
export const authLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: env.isProd ? 40 : 400,
  message: { error: "Too many authentication requests. Try again later." },
});