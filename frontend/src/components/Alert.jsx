import { CircleCheck, Info, TriangleAlert } from "lucide-react";

const STYLES = {
  error: { box: "border-red-500/40 bg-red-500/10 text-red-200", Icon: TriangleAlert },
  success: { box: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200", Icon: CircleCheck },
  info: { box: "border-sky-500/40 bg-sky-500/10 text-sky-200", Icon: Info },
  warning: { box: "border-amber-500/40 bg-amber-500/10 text-amber-200", Icon: TriangleAlert },
};

export default function Alert({ type = "info", children }) {
  if (!children) return null;
  const { box, Icon } = STYLES[type];
  return (
    <div role={type === "error" ? "alert" : "status"} className={`flex gap-2 rounded-lg border px-3 py-2 text-sm ${box}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}