import mongoose from "mongoose";

// One-time WebAuthn challenges. Consumed atomically with findOneAndDelete,
// which is what stops replay of a captured registration/assertion.
const challengeSchema = new mongoose.Schema({
  challenge: { type: String, required: true, unique: true },
  purpose: { type: String, enum: ["register", "authenticate"], required: true },
  // Only for purpose "authenticate": how the ceremony was started
  mode: { type: String, enum: ["mfa", "quick", "discoverable", null], default: null },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  // TTL index: MongoDB removes expired documents automatically (checked every ~60s).
  // The controllers also compare expiresAt, so expiry is exact even before cleanup runs.
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
});

export const Challenge = mongoose.model("Challenge", challengeSchema);
