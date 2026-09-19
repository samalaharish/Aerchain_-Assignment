import { clsx } from "clsx";

type StatusBadgeProps = {
  status: string;
  tone?: "neutral" | "success" | "warning" | "danger";
};

export function StatusBadge({ status, tone = "neutral" }: StatusBadgeProps) {
  return (
    <span
      className={clsx("inline-flex rounded-md border px-2 py-1 text-xs font-semibold uppercase tracking-wide", {
        "border-line bg-panel text-muted": tone === "neutral",
        "border-emerald-200 bg-emerald-50 text-emerald-700": tone === "success",
        "border-amber-200 bg-amber-50 text-amber-700": tone === "warning",
        "border-red-200 bg-red-50 text-red-700": tone === "danger"
      })}
    >
      {status}
    </span>
  );
}
