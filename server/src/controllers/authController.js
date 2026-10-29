import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { HttpError } from "../utils/httpError.js";
import { computeRisk } from "../utils/risk.js";
import {
  clearAuthCookies,
  setPendingCookie,
  setSessionCookie,
  signPending,
  signSession,
} from "../utils/tokens.js";

const BCRYPT_ROUNDS = 12;
// Compared against when the email is unknown, so response time doesn't reveal valid emails.
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing-only", BCRYPT_ROUNDS);

const email = z.string().trim().toLowerCase().pipe(z.email().max(254));

export const registerSchema = z.object({
  email,
  username: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_.-]+$/, "Only letters, numbers, dot, dash and underscore"),
  password: z.string().min(12, "Use at least 12 characters").max(128),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
});

function sessionPayload(session) {
  return {
    method: session.method,
    risk: session.risk,
    expiresAt: session.expiresAt,
  };
}

/** Issue a full session cookie and return the session summary for the response body. */
export function startSession(res, user, { method, risk }) {
  const token = signSession(user, { method, risk });
  setSessionCookie(res, token);
  const exp = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).exp * 1000;
  return sessionPayload({ method, risk, expiresAt: exp });
}

export async function register(req, res) {
  const { email: mail, username, password } = req.body;

  if (await User.exists({ email: mail })) {
    throw new HttpError(409, "An account with this email already exists");
  }

  const user = await User.create({
    email: mail,
    username,
    passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
    webauthnUserID: crypto.randomBytes(32).toString("base64url"),
    lastLoginAt: new Date(),
  });

  const risk = { score: 0, level: "low", reasons: ["First sign-in"] };
  const session = startSession(res, user, { method: "password", risk });

  await req.audit("register_success", { user, method: "password", risk });
  res.status(201).json({ user: user.toSafeJSON(), session, mfaRequired: false });
}

export async function login(req, res) {
  const { email: mail, password } = req.body;

  const user = await User.findOne({ email: mail }).select("+passwordHash");

  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    await req.audit("login_failed", { email: mail, success: false, details: "Unknown email" });
    throw new HttpError(401, "Invalid email or password");
  }

  if (user.isLocked()) {
    const retryAfterSeconds = Math.ceil((user.lockUntil.getTime() - Date.now()) / 1000);
    await req.audit("login_locked", { user, success: false, details: "Attempt while locked" });
    throw new HttpError(423, "Account temporarily locked due to repeated failed attempts", {
      retryAfterSeconds,
    });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);

  if (!ok) {
    // Atomic increment, then re-read (two simple ops work on every MongoDB-compatible server)
    await User.updateOne({ _id: user._id }, { $inc: { failedLoginAttempts: 1 } });
    const updated = await User.findById(user._id);
    let locked = false;
    if (updated.failedLoginAttempts >= env.MAX_LOGIN_ATTEMPTS) {
      updated.failedLoginAttempts = 0;
      updated.lockUntil = new Date(Date.now() + env.LOCKOUT_MINUTES * 60 * 1000);
      await updated.save();
      locked = true;
    }
    await req.audit("login_failed", {
      user,
      success: false,
      details: locked ? `Account locked for ${env.LOCKOUT_MINUTES} minutes` : "Wrong password",
    });
    throw new HttpError(
      locked ? 423 : 401,
      locked ? "Account temporarily locked due to repeated failed attempts" : "Invalid email or password",
      locked ? { retryAfterSeconds: env.LOCKOUT_MINUTES * 60 } : {}
    );
  }

  // Password correct: reset counters
  user.failedLoginAttempts = 0;
  user.lockUntil = null;

  const risk = await computeRisk({
    user,
    ip: req.ip,
    userAgent: req.get("user-agent") || "",
    method: "password",
  });

  // Step-up: MFA is required if switched on, OR if the sign-in looks high-risk
  // and a biometric authenticator is available.
  const hasDevices = user.credentials.length > 0;
  const mfaRequired = hasDevices && (user.mfaEnabled || risk.level === "high");

  if (mfaRequired) {
    await user.save();
    setPendingCookie(res, signPending(user, { risk }));
    await req.audit("login_mfa_required", {
      user,
      method: "password",
      risk,
      details: user.mfaEnabled ? "MFA enabled" : "Step-up due to high risk",
    });
    return res.json({
      mfaRequired: true,
      user: { email: user.email, username: user.username },
      risk,
    });
  }

  user.lastLoginAt = new Date();
  await user.save();
  const session = startSession(res, user, { method: "password", risk });
  await req.audit("login_success", { user, method: "password", risk });
  res.json({ mfaRequired: false, user: user.toSafeJSON(), session });
}

export async function logout(req, res) {
  clearAuthCookies(res);
  res.json({ ok: true });
}

export async function me(req, res) {
  res.json({
    user: req.user.toSafeJSON(),
    session: {
      method: req.session.method,
      risk: req.session.risk,
      issuedAt: req.session.issuedAt,
      expiresAt: req.session.expiresAt,
    },
  });
}