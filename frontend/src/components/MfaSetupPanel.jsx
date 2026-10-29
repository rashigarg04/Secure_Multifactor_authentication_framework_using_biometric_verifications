import { Fingerprint, Laptop, Loader2, Usb } from "lucide-react";
import { useEffect, useState } from "react";
import { getErrorMessage } from "../services/api.js";
import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  registerDevice,
} from "../services/webauthn.js";
import Alert from "./Alert.jsx";

const OPTIONS = [
  { id: "platform", label: "This device", hint: "Windows Hello, Touch ID, Face ID, Android biometrics", icon: Laptop },
  { id: "cross-platform", label: "Security key", hint: "USB / NFC key such as YubiKey", icon: Usb },
];

/** Enrollment panel for new biometric authenticators. */
export default function MfaSetupPanel({ deviceCount, onRegistered }) {
  const supported = browserSupportsWebAuthn();
  const [platformReady, setPlatformReady] = useState(null);
  const [attachment, setAttachment] = useState("platform");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!supported) return;
    platformAuthenticatorIsAvailable().then(setPlatformReady).catch(() => setPlatformReady(false));
  }, [supported]);

  async function enroll(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result = await registerDevice({
        attachment,
        deviceName: name.trim() || undefined,
      });
      setSuccess(`“${result.device.name}” registered. MFA is ${result.mfaEnabled ? "on" : "off"}.`);
      setName("");
      await onRegistered?.(result);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <h2 className="mb-1 flex items-center gap-2 text-base font-semibold">
        <Fingerprint className="h-5 w-5 text-emerald-400" /> Biometric MFA setup
      </h2>
      <p className="mb-4 text-sm text-slate-400">
        {deviceCount === 0
          ? "Register a fingerprint, face unlock or security key to add a second factor to your account."
          : "Add another device so you always have a backup way to sign in."}
      </p>

      {!supported && (
        <Alert type="warning">
          WebAuthn is not available here. Use a current browser on http://localhost:5173 or an HTTPS site.
        </Alert>
      )}

      {supported && (
        <form onSubmit={enroll} className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Authenticator type">
            {OPTIONS.map(({ id, label, hint, icon: Icon }) => (
              <button
                type="button"
                key={id}
                role="radio"
                aria-checked={attachment === id}
                onClick={() => setAttachment(id)}
                className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                  attachment === id ? "border-emerald-500 bg-emerald-500/10" : "border-slate-700 hover:border-slate-500"
                }`}
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                <span>
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-xs text-slate-400">{hint}</span>
                </span>
              </button>
            ))}
          </div>

          {attachment === "platform" && platformReady === false && (
            <Alert type="warning">
              No built-in biometric or screen-lock authenticator was detected. Set up Windows Hello / Touch ID
              in your OS settings, or choose “Security key”.
            </Alert>
          )}

          <div>
            <label htmlFor="device-name" className="mb-1 block text-sm text-slate-300">
              Device name <span className="text-slate-500">(optional)</span>
            </label>
            <input
              id="device-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="e.g. Work laptop"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
          </div>

          <Alert type="error">{error}</Alert>
          <Alert type="success">{success}</Alert>

          <button
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
            {busy ? "Waiting for your device…" : "Register biometric device"}
          </button>
        </form>
      )}
    </section>
  );
}