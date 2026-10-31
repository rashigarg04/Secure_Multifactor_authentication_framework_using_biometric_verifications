import mongoose from "mongoose";

const credentialSchema = new mongoose.Schema(
  {
    // base64url credential ID as returned by the browser (response.id)
    credentialID: { type: String, required: true },
    publicKey: { type: Buffer, required: true }, // COSE public key bytes
    counter: { type: Number, default: 0 },
    transports: { type: [String], default: [] }, // "internal", "usb", "nfc", "ble", "hybrid"
    deviceType: { type: String, enum: ["singleDevice", "multiDevice"], default: "singleDevice" },
    backedUp: { type: Boolean, default: false },
    aaguid: { type: String, default: "" },
    name: { type: String, default: "Biometric device", trim: true, maxlength: 60 },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    username: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false },

    // Stable random WebAuthn user handle (base64url). Never the email or Mongo _id.
    webauthnUserID: { type: String, required: true, unique: true },

    mfaEnabled: { type: Boolean, default: false },
    credentials: { type: [credentialSchema], default: [] },

    // Retina verification (prototype). The template is encrypted before it is stored
    // and is never returned by normal queries (select: false).
    retina: {
      enrolled: { type: Boolean, default: false },
      template: { type: Buffer, select: false },
      enrolledAt: { type: Date, default: null },
      consentAt: { type: Date, default: null }, // when the user agreed to template storage
      lastVerifiedAt: { type: Date, default: null },
    },

    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.index({ "credentials.credentialID": 1 }, { unique: true, sparse: true });

userSchema.methods.isLocked = function () {
  return Boolean(this.lockUntil && this.lockUntil.getTime() > Date.now());
};

/** Number of second factors the account has (biometric devices + retina). */
userSchema.methods.secondFactorCount = function () {
  return this.credentials.length + (this.retina?.enrolled ? 1 : 0);
};

userSchema.methods.toSafeJSON = function () {
  return {
    id: this.id,
    email: this.email,
    username: this.username,
    mfaEnabled: this.mfaEnabled,
    deviceCount: this.credentials.length,
    retinaEnrolled: Boolean(this.retina?.enrolled),
    createdAt: this.createdAt,
    lastLoginAt: this.lastLoginAt,
  };
};

export function toSafeDevice(c) {
  return {
    id: c.credentialID,
    name: c.name,
    deviceType: c.deviceType,
    backedUp: c.backedUp,
    transports: c.transports,
    createdAt: c.createdAt,
    lastUsedAt: c.lastUsedAt,
  };
}

export const User = mongoose.model("User", userSchema);
