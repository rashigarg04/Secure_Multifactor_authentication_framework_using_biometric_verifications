import crypto from "node:crypto";
import { env } from "../config/env.js";
import { HttpError } from "./httpError.js";

export const CHALLENGE_TTL_MS = 5 * 60 * 1000;

/**
 * Pull the challenge out of the browser's clientDataJSON so we can look it up
 * (and atomically delete it) before verifying. The signature check inside
 * SimpleWebAuthn still verifies the challenge cryptographically afterwards.
 */
export function extractChallenge(response) {
  try {
    const raw = response?.response?.clientDataJSON;
    if (typeof raw !== "string") throw new Error("missing");
    const json = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (typeof json.challenge !== "string" || !json.challenge) throw new Error("missing");
    return json.challenge;
  } catch {
    throw new HttpError(400, "Malformed WebAuthn response");
  }
}

/**
 * Stable fake credential ID for unknown emails so "Quick Biometric Login"
 * doesn't reveal which emails are registered.
 */
export function decoyCredentialId(email) {
  return crypto.createHmac("sha256", env.JWT_SECRET).update(`decoy:${email}`).digest("base64url");
}