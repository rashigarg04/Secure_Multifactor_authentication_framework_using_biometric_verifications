import { AuditLog } from "../models/AuditLog.js";

/** Reduce a User-Agent string to "browser|os" so minor version bumps don't look like a new device. */
export function deviceFingerprint(ua = "") {
  const browser =
    (/(Edg|OPR|Firefox|Chrome|Safari)\//.exec(ua) || [])[1] || "unknown-browser";
  const os =
    (/(Windows|Mac OS X|Android|iPhone|iPad|CrOS|Linux)/.exec(ua) || [])[1] || "unknown-os";
  return `${browser}|${os}`;
}

export function levelFor(score) {
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}

/**
 * Simple, explainable risk score (0-100) for a sign-in attempt.
 * Reasons are returned so the dashboard can show WHY a session is risky.
 */
export async function computeRisk({ user, ip, userAgent, method }) {
  const reasons = [];
  let score = 0;

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [history, recentFailures] = await Promise.all([
    AuditLog.find({
      user: user._id,
      success: true,
      event: { $in: ["login_success", "biometric_login_success"] },
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean(),
    AuditLog.countDocuments({
      user: user._id,
      success: false,
      event: { $in: ["login_failed", "biometric_login_failed"] },
      createdAt: { $gte: since24h },
    }),
  ]);

  if (history.length > 0) {
    const knownIps = new Set(history.map((h) => h.ip));
    const knownDevices = new Set(history.map((h) => deviceFingerprint(h.userAgent)));

    if (!knownIps.has(ip)) {
      score += 25;
      reasons.push("Sign-in from a new IP address");
    }
    if (!knownDevices.has(deviceFingerprint(userAgent))) {
      score += 20;
      reasons.push("Sign-in from a new browser or operating system");
    }
  }

  if (recentFailures > 0) {
    score += Math.min(30, recentFailures * 10);
    reasons.push(`${recentFailures} failed attempt(s) in the last 24 hours`);
  }

  const usedBiometric = method === "biometric" || method === "password+biometric";
  if (!usedBiometric && user.credentials.length > 0 && !user.mfaEnabled) {
    score += 15;
    reasons.push("Biometric MFA is registered but switched off");
  }

  if (usedBiometric) {
    score = Math.max(0, score - 20);
    reasons.push("Verified with a biometric authenticator");
  }

  score = Math.min(100, score);
  return { score, level: levelFor(score), reasons };
}