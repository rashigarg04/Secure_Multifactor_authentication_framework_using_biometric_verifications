import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { HttpError } from "../utils/httpError.js";
import { decryptTemplate, encryptTemplate } from "../utils/retinaCrypto.js";
import { extractTemplate, matchProbe } from "../utils/retinaClient.js";
import { computeRisk } from "../utils/risk.js";
import { recordFailedAttempt } from "../utils/lockout.js";
import { clearAuthCookies, readPending } from "../utils/tokens.js";
import { confirmPassword } from "./accountController.js";
import { startSession } from "./authController.js";

function requireEnabled() {
  if (!env.retinaEnabled) throw new HttpError(503, "Retina verification is not enabled on this server.");
}

function requireImage(req) {
  if (!req.file) throw new HttpError(400, 'Attach a retinal photograph in the "image" field.');
}

export async function status(req, res) {
  const r = req.user.retina ?? {};
  res.json({
    available: env.retinaEnabled,
    enrolled: Boolean(r.enrolled),
    enrolledAt: r.enrolledAt ?? null,
    lastVerifiedAt: r.lastVerifiedAt ?? null,
  });
}

/** Enrol the signed-in user's retina from one fundus photograph. */
export async function enroll(req, res) {
  requireEnabled();
  requireImage(req);
  const user = req.user;

  // Explicit consent is required before any biometric template is stored.
  if (req.body?.consent !== "true") {
    throw new HttpError(400, "You must give explicit consent before a retina template is stored.");
  }

  if (user.retina?.enrolled) {
    throw new HttpError(409, "A retina is already enrolled. Remove it first to enrol a new one.");
  }

  let result;
  try {
    result = await extractTemplate(req.file);
  } catch (err) {
    await req.audit("retina_enroll_failed", { user, success: false, details: err.extra?.code || err.message });
    throw err;
  }

  const firstFactor = user.secondFactorCount() === 0;
  user.retina = {
    enrolled: true,
    template: encryptTemplate(Buffer.from(result.template_b64, "base64"), String(user._id)),
    enrolledAt: new Date(),
    consentAt: new Date(),
    lastVerifiedAt: null,
  };
  if (firstFactor) user.mfaEnabled = true;
  await user.save();

  await req.audit("retina_enroll_success", { user, risk: req.session.risk, details: "Template stored (encrypted)" });
  if (firstFactor) await req.audit("mfa_enabled", { user, details: "Enabled with retina enrolment" });

  res.status(201).json({
    enrolled: true,
    mfaEnabled: user.mfaEnabled,
    quality: result.quality,
    // The extracted vessel pattern, for the user to see. It is NOT stored.
    preview: `data:image/png;base64,${result.preview_b64}`,
  });
}

/** Second step after the password: compare a new photograph with the stored template. */
export async function verify(req, res) {
  requireEnabled();
  requireImage(req);

  const pending = readPending(req);
  const expired = new HttpError(401, "Password step expired. Please sign in again.");
  if (!pending) throw expired;

  const user = await User.findById(pending.sub).select("+retina.template");
  if (!user || !user.retina?.enrolled || !user.retina.template) throw expired;

  const fail = async (reason, status = 401, extra = {}) => {
    await req.audit("retina_verify_failed", { user, success: false, details: reason });
    throw new HttpError(status, "Retina verification failed", extra);
  };

  if (user.isLocked()) return fail("Account locked", 423);

  let match;
  try {
    const template = decryptTemplate(user.retina.template, String(user._id));
    match = await matchProbe(req.file, template);
  } catch (err) {
    // Unusable image (blurry, not a retina): audit it, but it is not a failed guess.
    if (err instanceof HttpError && err.status === 422) {
      await req.audit("retina_verify_failed", { user, success: false, details: `Image rejected: ${err.extra?.code}` });
      throw err;
    }
    throw err;
  }

  if (match.score < env.RETINA_THRESHOLD) {
    const { locked, retryAfterSeconds } = await recordFailedAttempt(user._id);
    await req.audit("retina_verify_failed", {
      user,
      success: false,
      details: `No match${locked ? "; account locked" : ""}`,
    });
    throw new HttpError(locked ? 423 : 401, locked ? "Account temporarily locked" : "Retina verification failed", {
      ...(locked ? { retryAfterSeconds } : {}),
      // Scores are shown only outside production, to help with tuning and demos.
      ...(env.isProd ? {} : { score: match.score, threshold: env.RETINA_THRESHOLD }),
    });
  }

  user.retina.lastVerifiedAt = new Date();
  user.lastLoginAt = new Date();
  user.failedLoginAttempts = 0;
  await user.save();

  const method = "password+retina";
  const risk = await computeRisk({ user, ip: req.ip, userAgent: req.get("user-agent") || "", method });
  clearAuthCookies(res); // drops the pending cookie
  const session = startSession(res, user, { method, risk });
  await req.audit("retina_verify_success", { user, method, risk, details: `Score ${match.score}` });

  res.json({
    verified: true,
    user: user.toSafeJSON(),
    session,
    ...(env.isProd ? {} : { score: match.score, threshold: env.RETINA_THRESHOLD }),
  });
}

/** Delete the stored retina template (password required). */
export async function remove(req, res) {
  const user = req.user;
  if (!user.retina?.enrolled) throw new HttpError(404, "No retina is enrolled.");

  await confirmPassword(req, req.body.password);

  user.retina.enrolled = false;
  user.retina.enrolledAt = null;
  user.retina.consentAt = null;
  user.retina.lastVerifiedAt = null;
  user.set("retina.template", undefined);

  let mfaDisabled = false;
  if (user.secondFactorCount() === 0 && user.mfaEnabled) {
    user.mfaEnabled = false;
    mfaDisabled = true;
  }
  await user.save();

  await req.audit("retina_removed", { user, details: "Template deleted" });
  if (mfaDisabled) await req.audit("mfa_disabled", { user, details: "Last second factor removed" });
  res.json({ ok: true, mfaEnabled: user.mfaEnabled });
}
