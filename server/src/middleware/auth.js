import { User } from "../models/User.js";
import { SESSION_COOKIE, clearAuthCookies, verifySession } from "../utils/tokens.js";

/** Session guard: requires a valid, full (post-MFA) session cookie. */
export async function requireAuth(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return res.status(401).json({ error: "Authentication required" });

  let payload;
  try {
    payload = verifySession(token);
  } catch {
    clearAuthCookies(res);
    return res.status(401).json({ error: "Session expired. Please sign in again." });
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    clearAuthCookies(res);
    return res.status(401).json({ error: "Account not found" });
  }

  req.user = user;
  req.session = {
    method: payload.method,
    risk: payload.risk,
    issuedAt: payload.iat * 1000,
    expiresAt: payload.exp * 1000,
  };
  next();
}