import { z } from "zod";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { env } from "../config/env.js";
import { Challenge } from "../models/Challenge.js";
import { User, toSafeDevice } from "../models/User.js";
import { HttpError } from "../utils/httpError.js";
import { computeRisk } from "../utils/risk.js";
import { clearAuthCookies, readPending } from "../utils/tokens.js";
import {
  CHALLENGE_TTL_MS,
  decoyCredentialId,
  extractChallenge,
} from "../utils/webauthn.js";
import { startSession } from "./authController.js";

const MAX_DEVICES = 10;

export const registrationOptionsSchema = z.object({
  // "platform" = built-in (Windows Hello / Touch ID / Face ID), "cross-platform" = USB/NFC security key
  attachment: z.enum(["platform", "cross-platform"]).optional(),
});

export const verifyRegistrationSchema = z.object({
  response: z.object({ id: z.string(), response: z.object({}).loose() }).loose(),
  deviceName: z.string().trim().min(1).max(60).optional(),
});

export const authenticationOptionsSchema = z.object({
  mode: z.enum(["mfa", "quick", "discoverable"]),
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)).optional(),
});

export const verifyAuthenticationSchema = z.object({
  response: z.object({ id: z.string(), response: z.object({}).loose() }).loose(),
});

const newExpiry = () => new Date(Date.now() + CHALLENGE_TTL_MS);

/* ------------------------------------------------------------------ */
/* Registration (user must already have a full session)               */
/* ------------------------------------------------------------------ */

export async function generateRegistrationOptionsHandler(req, res) {
  const user = req.user;

  if (user.credentials.length >= MAX_DEVICES) {
    throw new HttpError(400, `You can register at most ${MAX_DEVICES} devices`);
  }

  const options = await generateRegistrationOptions({
    rpName: env.RP_NAME,
    rpID: env.RP_ID,
    userName: user.email,
    userDisplayName: user.username,
    userID: Buffer.from(user.webauthnUserID, "base64url"),
    attestationType: "none",
    // Stops the same authenticator from being registered twice
    excludeCredentials: user.credentials.map((c) => ({
      id: c.credentialID,
      transports: c.transports,
    })),
    authenticatorSelection: {
      residentKey: "preferred", // discoverable credential -> enables passkey "Quick Login"
      userVerification: "required", // fingerprint / face / PIN must be checked
      ...(req.body.attachment ? { authenticatorAttachment: req.body.attachment } : {}),
    },
  });

  await Challenge.create({
    challenge: options.challenge,
    purpose: "register",
    user: user._id,
    expiresAt: newExpiry(),
  });

  res.json(options);
}

export async function verifyRegistrationHandler(req, res) {
  const user = req.user;
  const { response, deviceName } = req.body;

  const challenge = extractChallenge(response);
  const record = await Challenge.findOneAndDelete({
    challenge,
    purpose: "register",
    user: user._id,
  });

  if (!record || record.expiresAt.getTime() < Date.now()) {
    throw new HttpError(400, "Registration challenge expired or invalid. Please try again.");
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: env.ORIGIN,
      expectedRPID: env.RP_ID,
      requireUserVerification: true,
    });
  } catch (err) {
    await req.audit("biometric_register_failed", { user, success: false, details: err.message });
    throw new HttpError(400, `Registration could not be verified: ${err.message}`);
  }

  if (!verification.verified || !verification.registrationInfo) {
    await req.audit("biometric_register_failed", { user, success: false, details: "Not verified" });
    throw new HttpError(400, "Registration could not be verified");
  }

  const { credential, credentialDeviceType, credentialBackedUp, aaguid } =
    verification.registrationInfo;

  if (user.credentials.some((c) => c.credentialID === credential.id)) {
    throw new HttpError(409, "This authenticator is already registered");
  }

  user.credentials.push({
    credentialID: credential.id,
    publicKey: Buffer.from(credential.publicKey),
    counter: credential.counter,
    transports: response.response.transports ?? credential.transports ?? [],
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    aaguid: aaguid ?? "",
    name: deviceName || `Device ${user.credentials.length + 1}`,
  });

  const firstDevice = user.credentials.length === 1;
  if (firstDevice) user.mfaEnabled = true; // turn MFA on automatically with the first device
  await user.save();

  const device = user.credentials[user.credentials.length - 1];
  await req.audit("biometric_register_success", {
    user,
    risk: req.session.risk,
    details: `Registered "${device.name}"`,
  });
  if (firstDevice) await req.audit("mfa_enabled", { user, details: "Enabled with first device" });

  res.status(201).json({
    verified: true,
    mfaEnabled: user.mfaEnabled,
    device: toSafeDevice(device),
  });
}

/* ------------------------------------------------------------------ */
/* Authentication                                                     */
/* mode "mfa"          : second step after password (pending cookie)  */
/* mode "quick"        : biometric sign-in, user typed their email    */
/* mode "discoverable" : passkey sign-in, no email needed             */
/* ------------------------------------------------------------------ */

export async function generateAuthenticationOptionsHandler(req, res) {
  const { mode, email } = req.body;

  let user = null;
  let allowCredentials; // undefined => browser lists discoverable passkeys

  if (mode === "mfa") {
    const pending = readPending(req);
    if (!pending) throw new HttpError(401, "Password step expired. Please sign in again.");
    user = await User.findById(pending.sub);
    if (!user || user.credentials.length === 0) {
      throw new HttpError(401, "Password step expired. Please sign in again.");
    }
  } else if (mode === "quick") {
    if (!email) throw new HttpError(400, "Email is required for quick biometric login");
    const found = await User.findOne({ email });
    if (found && found.mfaEnabled && found.credentials.length > 0) {
      user = found;
    } else {
      // Unknown email / no biometrics: return a decoy so responses look identical.
      allowCredentials = [{ id: decoyCredentialId(email), transports: ["internal"] }];
    }
  }

  if (user) {
    allowCredentials = user.credentials.map((c) => ({
      id: c.credentialID,
      transports: c.transports,
    }));
  }

  const options = await generateAuthenticationOptions({
    rpID: env.RP_ID,
    allowCredentials,
    userVerification: "required",
  });

  await Challenge.create({
    challenge: options.challenge,
    purpose: "authenticate",
    mode,
    user: user?._id ?? null,
    expiresAt: newExpiry(),
  });

  res.json(options);
}

export async function verifyAuthenticationHandler(req, res) {
  const { response } = req.body;

  const challenge = extractChallenge(response);
  const record = await Challenge.findOneAndDelete({ challenge, purpose: "authenticate" });

  const reject = async (user, reason, status = 401) => {
    await req.audit("biometric_login_failed", { user, success: false, details: reason });
    throw new HttpError(status, "Biometric verification failed");
  };

  if (!record || record.expiresAt.getTime() < Date.now()) {
    return reject(null, "Challenge expired or already used", 400);
  }

  // 1) Work out which user this ceremony belongs to
  let user = null;
  if (record.mode === "mfa") {
    const pending = readPending(req);
    if (!pending || pending.sub !== String(record.user)) {
      return reject(null, "MFA session missing or mismatched");
    }
    user = await User.findById(record.user);
  } else if (record.mode === "quick") {
    if (!record.user) return reject(null, "Quick login for unknown account");
    user = await User.findById(record.user);
  } else {
    const handle = response.response.userHandle;
    if (!handle) return reject(null, "No user handle (not a discoverable credential)");
    user = await User.findOne({ webauthnUserID: handle });
  }
  if (!user) return reject(null, "User not found");

  if (user.isLocked()) return reject(user, "Account locked", 423);

  // Quick and discoverable sign-in replace the password, so they only work while MFA is on.
  if (record.mode !== "mfa" && !user.mfaEnabled) {
    return reject(user, "Biometric sign-in disabled for this account");
  }

  // 2) Find the matching registered authenticator
  const cred = user.credentials.find((c) => c.credentialID === response.id);
  if (!cred) return reject(user, "Credential not registered to this account");

  // 3) Verify signature, challenge, origin, RP ID, user verification and counter
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: env.ORIGIN,
      expectedRPID: env.RP_ID,
      requireUserVerification: true,
      credential: {
        id: cred.credentialID,
        publicKey: new Uint8Array(cred.publicKey),
        counter: cred.counter,
        transports: cred.transports,
      },
    });
  } catch (err) {
    return reject(user, err.message);
  }

  if (!verification.verified) return reject(user, "Signature not verified");

  const { newCounter, credentialDeviceType, credentialBackedUp } = verification.authenticationInfo;

  cred.counter = newCounter;
  cred.deviceType = credentialDeviceType;
  cred.backedUp = credentialBackedUp;
  cred.lastUsedAt = new Date();
  user.lastLoginAt = new Date();
  user.failedLoginAttempts = 0;
  await user.save();

  const method = record.mode === "mfa" ? "password+biometric" : "biometric";
  const risk = await computeRisk({
    user,
    ip: req.ip,
    userAgent: req.get("user-agent") || "",
    method,
  });

  clearAuthCookies(res); // drops the pending cookie
  const session = startSession(res, user, { method, risk });
  await req.audit("biometric_login_success", {
    user,
    method,
    risk,
    details: `Device "${cred.name}"`,
  });

  res.json({ verified: true, user: user.toSafeJSON(), session });
}