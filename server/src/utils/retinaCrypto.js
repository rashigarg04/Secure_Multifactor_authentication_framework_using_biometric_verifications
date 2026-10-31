import crypto from "node:crypto";
import { env } from "../config/env.js";

// Stored layout: iv (12 bytes) | auth tag (16 bytes) | ciphertext
// The user's id is bound in as "additional authenticated data", so a template copied
// from one user's record into another's will fail to decrypt.
const key = () => Buffer.from(env.RETINA_TEMPLATE_KEY, "hex");

export function encryptTemplate(plain, userId) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(userId));
  const data = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]);
}

export function decryptTemplate(stored, userId) {
  const buf = Buffer.from(stored);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
  decipher.setAAD(Buffer.from(userId));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]);
}
