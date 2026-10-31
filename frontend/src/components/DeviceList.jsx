import { Check, Cloud, Cpu, KeyRound, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import { formatDateTime, timeAgo } from "../utils/format.js";

function DeviceRow({ device, onRename, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(device.name);
  const [saving, setSaving] = useState(false);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === device.name) return setEditing(false);
    setSaving(true);
    try {
      await onRename(device.id, trimmed);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  const synced = device.deviceType === "multiDevice";

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 sm:flex-row sm:items-center">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
        <KeyRound className="h-5 w-5 text-emerald-400" />
      </div>

      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") setEditing(false);
              }}
              className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm outline-none focus:border-emerald-500"
              aria-label="Device name"
            />
            <button onClick={save} disabled={saving} className="rounded p-1 text-emerald-400 hover:bg-slate-800" aria-label="Save name">
              <Check className="h-4 w-4" />
            </button>
            <button onClick={() => setEditing(false)} className="rounded p-1 text-slate-400 hover:bg-slate-800" aria-label="Cancel rename">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <p className="truncate text-sm font-medium">{device.name}</p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1">
            {synced ? <Cloud className="h-3 w-3" /> : <Cpu className="h-3 w-3" />}
            {synced ? "Synced passkey" : "Device-bound"}
            {synced && device.backedUp ? " (backed up)" : ""}
          </span>
          {device.transports.length > 0 && <span>{device.transports.join(", ")}</span>}
          <span title={formatDateTime(device.createdAt)}>Added {timeAgo(device.createdAt)}</span>
          <span>{device.lastUsedAt ? `Last used ${timeAgo(device.lastUsedAt)}` : "Never used to sign in"}</span>
        </div>
      </div>

      {!editing && (
        <div className="flex gap-1 self-end sm:self-auto">
          <button onClick={() => setEditing(true)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200" aria-label={`Rename ${device.name}`}>
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={() => onRemove(device)} className="rounded-lg p-2 text-slate-400 hover:bg-red-500/10 hover:text-red-400" aria-label={`Remove ${device.name}`}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </li>
  );
}

export default function DeviceList({ devices, onRename, onRemove }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <h2 className="mb-3 text-base font-semibold">Registered devices ({devices.length})</h2>
      {devices.length === 0 ? (
        <p className="text-sm text-slate-400">No biometric devices registered yet.</p>
      ) : (
        <ul className="space-y-2">
          {devices.map((d) => (
            <DeviceRow key={d.id} device={d} onRename={onRename} onRemove={onRemove} />
          ))}
        </ul>
      )}
    </section>
  );
}
