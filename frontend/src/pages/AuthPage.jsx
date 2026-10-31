import {
  Eye,
  Fingerprint,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  User,
  UserPlus,
} from "lucide-react";
import { useState } from "react";
import Alert from "../components/Alert.jsx";
import RiskBadge from "../components/RiskBadge.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { authApi, getErrorMessage } from "../services/api.js";
import { retinaApi } from "../services/retina.js";
import { authenticate, browserSupportsWebAuthn } from "../services/webauthn.js";

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-emerald-500";

function Field({ id, label, icon: Icon, ...props }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm text-slate-300">
        {label}
      </label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
        <input id={id} className={inputClass} {...props} />
      </div>
    </div>
  );
}

function SubmitButton({ busy, children, icon: Icon, variant = "primary", ...props }) {
  const styles =
    variant === "primary"
      ? "bg-emerald-600 hover:bg-emerald-500"
      : "border border-slate-700 bg-slate-800 hover:bg-slate-700";
  return (
    <button
      disabled={busy}
      className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:opacity-50 ${styles}`}
      {...props}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}

function passwordStrength(pw) {
  let score = 0;
  if (pw.length >= 12) score++;
  if (pw.length >= 16) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

export default function AuthPage() {
  const { setAuth } = useAuth();
  const supported = browserSupportsWebAuthn();

  const [tab, setTab] = useState("password"); // "password" | "biometric"
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [form, setForm] = useState({ email: "", username: "", password: "" });
  const [quickEmail, setQuickEmail] = useState("");
  const [mfaStep, setMfaStep] = useState(null); // { email, risk } after a correct password
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const strength = passwordStrength(form.password);

  function switchTab(next) {
    setTab(next);
    setError("");
  }

  async function submitPassword(e) {
    e.preventDefault();
    setBusy("password");
    setError("");
    try {
      if (mode === "signup") {
        setAuth(await authApi.register(form));
      } else {
        const data = await authApi.login({ email: form.email, password: form.password });
        if (data.mfaRequired) {
          setMfaStep({ email: data.user.email, risk: data.risk, methods: data.methods });
        } else {
          setAuth(data);
        }
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy("");
    }
  }

  async function runBiometric(kind, args) {
    setBusy(kind);
    setError("");
    try {
      setAuth(await authenticate(args));
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      // Password step expired (5 min): start over
      if (kind === "mfa" && /expired/i.test(message)) setMfaStep(null);
    } finally {
      setBusy("");
    }
  }

  async function runRetina(file) {
    if (!file) return;
    setBusy("retina");
    setError("");
    try {
      setAuth(await retinaApi.verify(file));
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      if (/expired/i.test(message)) setMfaStep(null);
    } finally {
      setBusy("");
    }
  }

  async function cancelMfa() {
    await authApi.logout().catch(() => {});
    setMfaStep(null);
    setForm((f) => ({ ...f, password: "" }));
    setError("");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/40 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/40">
            <ShieldCheck className="h-8 w-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-semibold">Secure MFA Framework</h1>
          <p className="text-sm text-slate-400">Password + biometric verification with WebAuthn</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur">
          {!supported && (
            <div className="mb-4">
              <Alert type="warning">
                This browser or context does not support WebAuthn. Use a current browser at
                http://localhost:5173 or an HTTPS site; biometric features are disabled.
              </Alert>
            </div>
          )}

          {mfaStep ? (
            /* ---------------- Step 2: biometric verification ---------------- */
            <div className="space-y-4">
              <div className="text-center">
                <Fingerprint className="mx-auto mb-2 h-12 w-12 text-emerald-400" />
                <h2 className="text-lg font-semibold">Verify it’s you</h2>
                <p className="text-sm text-slate-400">
                  Password accepted for <span className="text-slate-200">{mfaStep.email}</span>. Confirm
                  with your second factor to finish signing in.
                </p>
              </div>

              {mfaStep.risk?.level !== "low" && (
                <Alert type="warning">
                  <div className="mb-1 flex items-center gap-2 font-medium">
                    Unusual sign-in <RiskBadge level={mfaStep.risk.level} score={mfaStep.risk.score} />
                  </div>
                  <ul className="list-inside list-disc text-xs">
                    {mfaStep.risk.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </Alert>
              )}

              <Alert type="error">{error}</Alert>

              {mfaStep.methods?.webauthn && (
                <SubmitButton
                  busy={busy === "mfa"}
                  icon={Fingerprint}
                  disabled={!supported || Boolean(busy)}
                  onClick={() => runBiometric("mfa", { mode: "mfa" })}
                >
                  Verify with biometrics
                </SubmitButton>
              )}

              {mfaStep.methods?.retina && (
                <label
                  className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium transition hover:bg-slate-700 ${busy ? "pointer-events-none opacity-50" : ""}`}
                >
                  {busy === "retina" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                  {busy === "retina" ? "Checking retina…" : "Verify with a retinal photograph"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    className="sr-only"
                    aria-label="Retinal photograph"
                    onChange={(e) => {
                      runRetina(e.target.files?.[0]);
                      e.target.value = ""; // lets the same file be chosen again after a failure
                    }}
                  />
                </label>
              )}
              <button onClick={cancelMfa} className="w-full text-center text-sm text-slate-400 hover:text-slate-200">
                Cancel and use a different account
              </button>
            </div>
          ) : (
            <>
              {/* ---------------- Tabs ---------------- */}
              <div role="tablist" className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-slate-950 p-1">
                {[
                  ["password", "Password", KeyRound],
                  ["biometric", "Quick Biometric", Fingerprint],
                ].map(([id, label, Icon]) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={tab === id}
                    onClick={() => switchTab(id)}
                    className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      tab === id ? "bg-slate-800 text-white shadow" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                ))}
              </div>

              {tab === "password" ? (
                <form onSubmit={submitPassword} className="space-y-4">
                  <h2 className="text-lg font-semibold">{mode === "login" ? "Sign in" : "Create your account"}</h2>

                  <Field id="email" label="Email" icon={Mail} type="email" autoComplete="email" required value={form.email} onChange={update("email")} placeholder="you@example.com" />

                  {mode === "signup" && (
                    <Field id="username" label="Username" icon={User} autoComplete="username" required minLength={3} maxLength={32} pattern="[A-Za-z0-9_.\-]+" title="Letters, numbers, dot, dash, underscore" value={form.username} onChange={update("username")} placeholder="jane_doe" />
                  )}

                  <div>
                    <Field id="password" label="Password" icon={Lock} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "signup" ? 12 : 1} value={form.password} onChange={update("password")} placeholder={mode === "signup" ? "At least 12 characters" : "Your password"} />
                    {mode === "signup" && form.password && (
                      <div className="mt-2" aria-label={`Password strength ${strength} of 4`}>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4].map((i) => (
                            <div key={i} className={`h-1 flex-1 rounded ${i <= strength ? (strength < 3 ? "bg-amber-500" : "bg-emerald-500") : "bg-slate-700"}`} />
                          ))}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">12+ characters; mix letters, numbers and symbols.</p>
                      </div>
                    )}
                  </div>

                  <Alert type="error">{error}</Alert>

                  <SubmitButton busy={busy === "password"} icon={mode === "login" ? KeyRound : UserPlus}>
                    {mode === "login" ? "Sign in" : "Create account"}
                  </SubmitButton>

                  <p className="text-center text-sm text-slate-400">
                    {mode === "login" ? "New here? " : "Already registered? "}
                    <button
                      type="button"
                      onClick={() => {
                        setMode(mode === "login" ? "signup" : "login");
                        setError("");
                      }}
                      className="font-medium text-emerald-400 hover:underline"
                    >
                      {mode === "login" ? "Create an account" : "Sign in"}
                    </button>
                  </p>
                </form>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold">Quick biometric sign-in</h2>
                    <p className="text-sm text-slate-400">
                      Skip the password using the fingerprint, face or security key you already registered
                      from your dashboard.
                    </p>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      runBiometric("quick", { mode: "quick", email: quickEmail.trim() });
                    }}
                    className="space-y-3"
                  >
                    <Field id="quick-email" label="Email" icon={Mail} type="email" autoComplete="username webauthn" required value={quickEmail} onChange={(e) => setQuickEmail(e.target.value)} placeholder="you@example.com" />
                    <SubmitButton busy={busy === "quick"} icon={Fingerprint} disabled={!supported || Boolean(busy)}>
                      Continue with biometrics
                    </SubmitButton>
                  </form>

                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <div className="h-px flex-1 bg-slate-800" /> or <div className="h-px flex-1 bg-slate-800" />
                  </div>

                  <SubmitButton
                    variant="secondary"
                    busy={busy === "discoverable"}
                    icon={KeyRound}
                    disabled={!supported || Boolean(busy)}
                    onClick={() => runBiometric("discoverable", { mode: "discoverable" })}
                    type="button"
                  >
                    Use a saved passkey (no email)
                  </SubmitButton>

                  <Alert type="error">{error}</Alert>
                  <p className="text-xs text-slate-500">
                    Biometric sign-in only works after you have registered a device and while MFA is turned on.
                    Your fingerprint or face never leaves your device.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
