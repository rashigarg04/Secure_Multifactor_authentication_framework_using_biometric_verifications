import {
  Activity,
  Clock,
  Fingerprint,
  Gauge,
  Loader2,
  LogOut,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import ActivityLog from "../components/ActivityLog.jsx";
import Alert from "../components/Alert.jsx";
import ConfirmPasswordModal from "../components/ConfirmPasswordModal.jsx";
import DeviceList from "../components/DeviceList.jsx";
import MfaSetupPanel from "../components/MfaSetupPanel.jsx";
import RiskBadge from "../components/RiskBadge.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { accountApi, getErrorMessage } from "../services/api.js";
import { METHOD_LABELS, formatCountdown, formatDateTime } from "../utils/format.js";

function Card({ title, icon: Icon, children }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
        <Icon className="h-4 w-4" /> {title}
      </p>
      {children}
    </div>
  );
}

function Switch({ checked, onChange, disabled, label }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${checked ? "bg-emerald-600" : "bg-slate-600"}`}
    >
      <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${checked ? "translate-x-5" : ""}`} />
    </button>
  );
}

export default function DashboardPage() {
  const { user, session, logout, refresh } = useAuth();

  const [devices, setDevices] = useState([]);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ total30d: 0, failed30d: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [toggling, setToggling] = useState(false);
  const [modal, setModal] = useState(null); // { type: "removeDevice", device } | { type: "disableMfa" }
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, l] = await Promise.all([accountApi.devices(), accountApi.logs(50)]);
      setDevices(d.devices);
      setLogs(l.logs);
      setStats(l.stats);
      setError("");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Live session countdown; when it hits zero, ask the server (it will say 401 and we redirect)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const remaining = session ? session.expiresAt - now : 0;
  useEffect(() => {
    if (session && remaining <= 0) refresh();
  }, [session, remaining, refresh]);

  async function afterChange(message) {
    setNotice(message ?? "");
    await Promise.all([load(), refresh()]); // refresh() updates deviceCount / mfaEnabled in the header
  }

  async function toggleMfa(enable) {
    if (!enable) return setModal({ type: "disableMfa" });
    setToggling(true);
    setError("");
    try {
      await accountApi.setMfa(true);
      await afterChange("MFA enabled.");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setToggling(false);
    }
  }

  async function renameDevice(id, name) {
    try {
      await accountApi.renameDevice(id, name);
      await afterChange("");
    } catch (err) {
      setError(getErrorMessage(err));
      throw err;
    }
  }

  const risk = session?.risk ?? { level: "low", score: 0, reasons: [] };
  const mfaOn = user.mfaEnabled && devices.length > 0;
  const methodLabel = METHOD_LABELS[session?.method] ?? session?.method ?? "—";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <header className="border-b border-slate-800 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-emerald-400" />
            <span className="font-semibold">Security Dashboard</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right text-sm sm:block">
              <p className="font-medium">{user.username}</p>
              <p className="text-xs text-slate-400">{user.email}</p>
            </div>
            <button onClick={logout} className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        <Alert type="error">{error}</Alert>
        <Alert type="success">{notice}</Alert>

        {/* ---------- Status cards ---------- */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card title="Multi-factor authentication" icon={mfaOn ? ShieldCheck : ShieldAlert}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={`text-lg font-semibold ${mfaOn ? "text-emerald-400" : "text-amber-400"}`}>{mfaOn ? "Protected" : "Not protected"}</p>
                <p className="text-xs text-slate-400">
                  {devices.length === 0
                    ? "Register a device to enable MFA"
                    : mfaOn
                      ? "Biometric check required at sign-in"
                      : "Password alone can sign in"}
                </p>
              </div>
              <Switch label="Toggle MFA" checked={user.mfaEnabled} disabled={toggling || devices.length === 0} onChange={toggleMfa} />
            </div>
          </Card>

          <Card title="Session risk" icon={Gauge}>
            <div className="flex items-center gap-3">
              <RiskBadge level={risk.level} score={risk.score} />
              <span className="text-xs text-slate-400">{methodLabel}</span>
            </div>
            <ul className="mt-2 space-y-0.5 text-xs text-slate-400">
              {risk.reasons.length === 0 ? <li>No risk signals detected</li> : risk.reasons.map((r) => <li key={r}>• {r}</li>)}
            </ul>
          </Card>

          <Card title="Current session" icon={Clock}>
            <p className="font-mono text-2xl font-semibold">{formatCountdown(remaining)}</p>
            <p className="text-xs text-slate-400">until sign-in expires</p>
            <p className="mt-2 text-xs text-slate-500">Last sign-in: {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "—"}</p>
          </Card>
        </div>

        {loading && devices.length === 0 && logs.length === 0 ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-400" aria-label="Loading" />
          </div>
        ) : (
          <>
            <div className="grid gap-5 lg:grid-cols-2">
              <MfaSetupPanel
                deviceCount={devices.length}
                onRegistered={(r) => afterChange(r.mfaEnabled ? "Device registered and MFA is on." : "Device registered.")}
              />
              <DeviceList devices={devices} onRename={renameDevice} onRemove={(device) => setModal({ type: "removeDevice", device })} />
            </div>

            <ActivityLog logs={logs} stats={stats} loading={loading} onRefresh={load} />
          </>
        )}

        <p className="flex items-center justify-center gap-2 pb-4 text-xs text-slate-500">
          <Fingerprint className="h-3 w-3" /> Biometric data never leaves your device; the server stores only a public key.
          <Activity className="h-3 w-3" />
        </p>
      </main>

      {modal?.type === "removeDevice" && (
        <ConfirmPasswordModal
          title={`Remove “${modal.device.name}”?`}
          description="This device will no longer be able to sign in. If it is your last device, MFA will be switched off."
          confirmLabel="Remove device"
          onClose={() => setModal(null)}
          onConfirm={async (password) => {
            await accountApi.removeDevice(modal.device.id, password);
            await afterChange(`“${modal.device.name}” removed.`);
          }}
        />
      )}
      {modal?.type === "disableMfa" && (
        <ConfirmPasswordModal
          title="Turn off MFA?"
          description="Anyone with your password will be able to sign in without a biometric check. Confirm your password to continue."
          confirmLabel="Turn off MFA"
          onClose={() => setModal(null)}
          onConfirm={async (password) => {
            await accountApi.setMfa(false, password);
            await afterChange("MFA turned off.");
          }}
        />
      )}
    </div>
  );
}