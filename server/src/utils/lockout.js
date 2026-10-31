import { env } from "../config/env.js";
import { User } from "../models/User.js";

/**
 * Count one failed secret-guess (wrong password or non-matching retina) and lock the
 * account after MAX_LOGIN_ATTEMPTS. Returns { locked, retryAfterSeconds }.
 */
export async function recordFailedAttempt(userId) {
  // Atomic increment, then re-read (two simple ops work on every MongoDB-compatible server)
  await User.updateOne({ _id: userId }, { $inc: { failedLoginAttempts: 1 } });
  const user = await User.findById(userId);
  if (user.failedLoginAttempts >= env.MAX_LOGIN_ATTEMPTS) {
    user.failedLoginAttempts = 0;
    user.lockUntil = new Date(Date.now() + env.LOCKOUT_MINUTES * 60 * 1000);
    await user.save();
    return { locked: true, retryAfterSeconds: env.LOCKOUT_MINUTES * 60 };
  }
  return { locked: false, retryAfterSeconds: 0 };
}
