const STYLES = {
  low: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  medium: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  high: "bg-red-500/15 text-red-300 ring-red-500/30",
};

export default function RiskBadge({ level = "low", score }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${STYLES[level] ?? STYLES.low}`}>
      {level}
      {typeof score === "number" && <span className="opacity-70">· {score}</span>}
    </span>
  );
}
