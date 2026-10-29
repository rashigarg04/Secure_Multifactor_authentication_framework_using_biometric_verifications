import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export const SESSION_COOKIE = "session";
export const PENDING_COOKIE = "mfa_pending";

const ISSUER = "secure-mfa-framework";
const ALG = "HS256";

// Audiences keep the two token types from being swapped for each other.
const AUD = { session: "session", pending: "mfa_pending" };

export function signSession(user, { method, risk }) {
  return jwt.sign({ method, risk }, env.JWT_SECRET, {
    subject: String(user._id),
    issuer: ISSUER,
    audience: AUD.session,
    expiresIn: env.JWT_EXPIRES_IN,
    algorithm: ALG,
  });
}

export function signPending(user, { risk }) {
  return jwt.sign({ risk }, env.JWT_SECRET, {
    subject: String(user._id),
    issuer: ISSUER,
    audience: AUD.pending,
    expiresIn: env.MFA_PENDING_EXPIRES_IN,
    algorithm: ALG,
  });
}

function verify(token, audience) {
  return jwt.verify(token, env.JWT_SECRET, {
    issuer: ISSUER,
    audience,
    algorithms: [ALG],
  });
}

export const verifySession = (token) => verify(token, AUD.session);
export const verifyPending = (token) => verify(token, AUD.pending);

function cookieOptions(token) {
  const { exp } = jwt.decode(token);
  return {
    httpOnly: true, // JavaScript cannot read it (limits XSS token theft)
    secure: env.isProd, // HTTPS only in production
    sameSite: "lax", // blocks cross-site POST/PATCH/DELETE (CSRF)
    path: "/",
    maxAge: Math.max(0, exp * 1000 - Date.now()),
  };
}

export function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, cookieOptions(token));
}

export function setPendingCookie(res, token) {
  res.cookie(PENDING_COOKIE, token, cookieOptions(token));
}

export function clearAuthCookies(res) {
  const base = { httpOnly: true, secure: env.isProd, sameSite: "lax", path: "/" };
  res.clearCookie(SESSION_COOKIE, base);
  res.clearCookie(PENDING_COOKIE, base);
}

export function readPending(req) {
  const token = req.cookies?.[PENDING_COOKIE];
  if (!token) return null;
  try {
    return verifyPending(token);
  } catch {
    return null;
  }
}