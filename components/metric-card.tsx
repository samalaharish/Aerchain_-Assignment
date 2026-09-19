import { clsx } from "clsx";

type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "success" | "warning";
};

export function MetricCard({ label, value, detail, tone = "neutral" }: MetricCardProps) {
  return (
    <article className="rounded-lg border border-line bg-white p-4 shadow-soft">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div
        className={clsx("mt-2 text-2xl font-semibold", {
          "text-ink": tone === "neutral",
          "text-accent": tone === "success",
          "text-warning": tone === "warning"
        })}
      >
        {value}
      </div>
      <p className="mt-1 text-sm text-muted">{detail}</p>
    </article>
  );
}
