import { AuditLog } from "../models/AuditLog.js";

/**
 * Attaches req.audit(event, opts) to every request. IP and User-Agent are captured
 * automatically. Audit failures never break the request.
 */
export function auditLogger(req, _res, next) {
  req.audit = async (event, { user, email, success = true, method = "", risk, details = "" } = {}) => {
    try {
      await AuditLog.create({
        user: user?._id ?? null,
        email: email ?? user?.email ?? "",
        event,
        success,
        ip: req.ip || "",
        userAgent: (req.get("user-agent") || "").slice(0, 300),
        method,
        risk: risk ? { score: risk.score, level: risk.level } : undefined,
        details: String(details).slice(0, 300),
      });
    } catch (err) {
      console.error("audit log write failed:", err.message);
    }
  };
  next();
}