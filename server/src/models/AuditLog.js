import mongoose from "mongoose";

export const AUDIT_EVENTS = [
  "register_success",
  "login_success",
  "login_failed",
  "login_locked",
  "login_mfa_required",
  "biometric_login_success",
  "biometric_login_failed",
  "biometric_register_success",
  "biometric_register_failed",
  "device_renamed",
  "device_removed",
  "mfa_enabled",
  "mfa_disabled",
  "sensitive_action_denied",
  "logout",
];

const auditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    email: { type: String, default: "" },
    event: { type: String, enum: AUDIT_EVENTS, required: true },
    success: { type: Boolean, default: true },
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "", maxlength: 300 },
    method: { type: String, default: "" }, // password | biometric | password+biometric
    risk: {
      score: { type: Number, default: 0 },
      level: { type: String, enum: ["low", "medium", "high"], default: "low" },
    },
    details: { type: String, default: "", maxlength: 300 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ user: 1, createdAt: -1 });

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);