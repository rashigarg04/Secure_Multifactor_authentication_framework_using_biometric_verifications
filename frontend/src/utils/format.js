export function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function formatDateTime(date) {
  return new Date(date).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatCountdown(ms) {
  if (ms <= 0) return "expired";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** "Mozilla/5.0 (Windows NT 10.0) ... Chrome/130" -> "Chrome on Windows" */
export function shortUserAgent(ua = "") {
  const browser = /(Edg|OPR|Firefox|Chrome|Safari)\//.exec(ua)?.[1];
  const names = { Edg: "Edge", OPR: "Opera" };
  const os = /(Windows|Mac OS X|Android|iPhone|iPad|CrOS|Linux)/.exec(ua)?.[1];
  const osNames = { "Mac OS X": "macOS", CrOS: "ChromeOS", iPhone: "iOS", iPad: "iPadOS" };
  if (!browser && !os) return ua ? ua.slice(0, 30) : "Unknown device";
  return `${names[browser] ?? browser ?? "Browser"} on ${osNames[os] ?? os ?? "unknown OS"}`;
}

export const EVENT_LABELS = {
  register_success: "Account created",
  login_success: "Password sign-in",
  login_failed: "Failed password sign-in",
  login_locked: "Sign-in blocked (account locked)",
  login_mfa_required: "Password OK, biometric required",
  biometric_login_success: "Biometric sign-in",
  biometric_login_failed: "Failed biometric sign-in",
  biometric_register_success: "Biometric device registered",
  biometric_register_failed: "Biometric registration failed",
  retina_enroll_success: "Retina enrolled",
  retina_enroll_failed: "Retina enrolment failed",
  retina_verify_success: "Retina sign-in",
  retina_verify_failed: "Failed retina sign-in",
  retina_removed: "Retina template deleted",
  device_renamed: "Device renamed",
  device_removed: "Device removed",
  mfa_enabled: "MFA enabled",
  mfa_disabled: "MFA disabled",
  sensitive_action_denied: "Sensitive action denied",
  logout: "Signed out",
};

export const METHOD_LABELS = {
  password: "Password only",
  biometric: "Biometric only",
  "password+biometric": "Password + biometric (MFA)",
  "password+retina": "Password + retina (MFA)",
};
