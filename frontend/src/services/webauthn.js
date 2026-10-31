import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import { api } from "./api.js";

export { browserSupportsWebAuthn, platformAuthenticatorIsAvailable };

/**
 * Enroll a new authenticator for the signed-in user.
 * attachment: "platform" (Windows Hello / Touch ID / Face ID) or "cross-platform" (security key)
 */
export async function registerDevice({ attachment, deviceName } = {}) {
  const { data: optionsJSON } = await api.post(
    "/auth/generate-registration-options",
    attachment ? { attachment } : {}
  );

  // Opens the OS biometric prompt
  const response = await startRegistration({ optionsJSON });

  const { data } = await api.post("/auth/verify-registration", { response, deviceName });
  return data;
}

/**
 * Run a WebAuthn sign-in ceremony.
 *   mode "mfa"          second step after a correct password
 *   mode "quick"        biometric sign-in for a typed email
 *   mode "discoverable" passkey sign-in with no email
 */
export async function authenticate({ mode, email } = {}) {
  const { data: optionsJSON } = await api.post("/auth/generate-authentication-options", {
    mode,
    ...(email ? { email } : {}),
  });

  const response = await startAuthentication({ optionsJSON });

  const { data } = await api.post("/auth/verify-authentication", { response });
  return data; // { verified, user, session }
}
