import { CircleCheck, CircleX, RefreshCw } from "lucide-react";
import { useState } from "react";
import { EVENT_LABELS, formatDateTime, shortUserAgent, timeAgo } from "../utils/format.js";
import RiskBadge from "./RiskBadge.jsx";

const FILTERS = [
  ["all", "All"],
  ["failed", "Failures"],
  ["biometric", "Biometric"],
];

export default function ActivityLog({ logs, stats, loading, onRefresh }) {
  const [filter, setFilter] = useState("all");

  const visible = logs.filter((l) => {
    if (filter === "failed") return !l.success;
    if (filter === "biometric") return l.event.startsWith("biometric") || l.method.includes("biometric");
    return true;
  });

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Authentication activity</h2>
          <p className="text-xs text-slate-400">
            Last 30 days: {stats.total30d} events, {stats.failed30d} failed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-slate-950 p-0.5 text-xs">
            {FILTERS.map(([id, label]) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={`rounded-md px-2.5 py-1 ${filter === id ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button onClick={onRefresh} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800" aria-label="Refresh activity">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">No matching activity.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-3 font-medium">Event</th>
                <th className="py-2 pr-3 font-medium">Device / IP</th>
                <th className="py-2 pr-3 font-medium">Risk</th>
                <th className="py-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {visible.map((l) => (
                <tr key={l.id}>
                  <td className="py-2 pr-3">
                    <div className="flex items-start gap-2">
                      {l.success ? (
                        <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      ) : (
                        <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                      )}
                      <div>
                        <p>{EVENT_LABELS[l.event] ?? l.event}</p>
                        {l.details && <p className="text-xs text-slate-500">{l.details}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-xs text-slate-400">
                    <p>{shortUserAgent(l.userAgent)}</p>
                    <p className="font-mono">{l.ip || "—"}</p>
                  </td>
                  <td className="py-2 pr-3">{l.risk ? <RiskBadge level={l.risk.level} score={l.risk.score} /> : "—"}</td>
                  <td className="py-2 text-xs text-slate-400" title={formatDateTime(l.createdAt)}>
                    {timeAgo(l.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}