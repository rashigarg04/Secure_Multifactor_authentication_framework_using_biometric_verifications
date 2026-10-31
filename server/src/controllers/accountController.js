import bcrypt from "bcryptjs";
import { z } from "zod";
import { AuditLog } from "../models/AuditLog.js";
import { User, toSafeDevice } from "../models/User.js";
import { HttpError } from "../utils/httpError.js";

export const renameSchema = z.object({ name: z.string().trim().min(1).max(60) });
export const passwordSchema = z.object({ password: z.string().min(1).max(128) });
export const mfaToggleSchema = z.object({
  enabled: z.boolean(),
  password: z.string().max(128).optional(),
});

/** Sensitive actions require the account password again (re-authentication). */
export async function confirmPassword(req, password) {
  const user = await User.findById(req.user._id).select("+passwordHash");
  const ok = password && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) {
    await req.audit("sensitive_action_denied", {
      user: req.user,
      success: false,
      details: "Wrong password on re-authentication",
    });
    throw new HttpError(403, "Password confirmation failed");
  }
}

export async function listDevices(req, res) {
  res.json({
    mfaEnabled: req.user.mfaEnabled,
    devices: req.user.credentials.map(toSafeDevice),
  });
}

export async function renameDevice(req, res) {
  const cred = req.user.credentials.find((c) => c.credentialID === req.params.id);
  if (!cred) throw new HttpError(404, "Device not found");
  const old = cred.name;
  cred.name = req.body.name;
  await req.user.save();
  await req.audit("device_renamed", { user: req.user, details: `"${old}" -> "${cred.name}"` });
  res.json({ device: toSafeDevice(cred) });
}

export async function removeDevice(req, res) {
  const cred = req.user.credentials.find((c) => c.credentialID === req.params.id);
  if (!cred) throw new HttpError(404, "Device not found");

  await confirmPassword(req, req.body.password);

  const name = cred.name;
  req.user.credentials = req.user.credentials.filter((c) => c.credentialID !== req.params.id);

  let mfaDisabled = false;
  if (req.user.secondFactorCount() === 0 && req.user.mfaEnabled) {
    req.user.mfaEnabled = false; // nothing left to verify with
    mfaDisabled = true;
  }
  await req.user.save();

  await req.audit("device_removed", { user: req.user, details: `Removed "${name}"` });
  if (mfaDisabled) {
    await req.audit("mfa_disabled", { user: req.user, details: "Last device removed" });
  }
  res.json({ ok: true, mfaEnabled: req.user.mfaEnabled });
}

export async function setMfa(req, res) {
  const { enabled, password } = req.body;
  const user = req.user;

  if (enabled) {
    if (user.secondFactorCount() === 0) {
      throw new HttpError(400, "Register a biometric device or enrol a retina before enabling MFA");
    }
  } else {
    await confirmPassword(req, password); // turning protection OFF needs the password
  }

  if (user.mfaEnabled !== enabled) {
    user.mfaEnabled = enabled;
    await user.save();
    await req.audit(enabled ? "mfa_enabled" : "mfa_disabled", { user, details: "Toggled by user" });
  }
  res.json({ mfaEnabled: user.mfaEnabled });
}

export async function listLogs(req, res) {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [logs, total30d, failed30d] = await Promise.all([
    AuditLog.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(limit).lean(),
    AuditLog.countDocuments({ user: req.user._id, createdAt: { $gte: since } }),
    AuditLog.countDocuments({ user: req.user._id, success: false, createdAt: { $gte: since } }),
  ]);

  res.json({
    stats: { total30d, failed30d },
    logs: logs.map((l) => ({
      id: String(l._id),
      event: l.event,
      success: l.success,
      ip: l.ip,
      userAgent: l.userAgent,
      method: l.method,
      risk: l.risk,
      details: l.details,
      createdAt: l.createdAt,
    })),
  });
}
