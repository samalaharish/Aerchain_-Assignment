"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Bot, CheckCircle2, FileWarning, GitCompare, Inbox, LineChart } from "lucide-react";
import { clsx } from "clsx";
import { DemoResetButton } from "@/components/demo-reset-button";

const workflowItems = [
  { href: "/dashboard", label: "Overview", icon: BarChart3 },
  { href: "/responses", label: "Responses", icon: Inbox },
  { href: "/comparison", label: "Compare", icon: GitCompare },
  { href: "/exceptions", label: "Exceptions", icon: FileWarning },
  { href: "/analyst", label: "Analyze", icon: Bot },
  { href: "/scenarios", label: "Scenarios", icon: LineChart },
  { href: "/approval", label: "Decision", icon: CheckCircle2 }
];

const stageItems = [
  { href: "/rfx", label: "RFx" },
  { href: "/responses", label: "Responses" },
  { href: "/exceptions", label: "Review" },
  { href: "/comparison", label: "Compare" },
  { href: "/analyst", label: "Analyze" },
  { href: "/approval", label: "Decision" }
];

type WorkflowNavProps = {
  statusLabel: string;
  providerLabel: string;
};

export function WorkflowNav({ statusLabel, providerLabel }: WorkflowNavProps) {
  const pathname = usePathname();

  return (
    <nav className="border-b border-line bg-white/95">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-lg font-semibold text-ink">Aerchain</div>
            <div className="text-sm font-medium text-muted">Corrugated Packaging RFx · 5 suppliers · 30 lines</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 md:flex">
              <span className="rounded-md border border-line bg-panel px-3 py-2 text-xs font-semibold text-muted">{statusLabel}</span>
              <span className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">{providerLabel}</span>
            </div>
            <DemoResetButton />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:hidden">
          <span className="rounded-md border border-line bg-panel px-3 py-2 text-xs font-semibold text-muted">{statusLabel}</span>
          <span className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">{providerLabel}</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {workflowItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition",
                  active
                    ? "border-accent bg-accent text-white"
                    : "border-line bg-white text-muted hover:border-accent hover:text-ink"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </div>
        <div className="hidden items-center gap-2 text-xs text-muted md:flex">
          {stageItems.map((item, index) => {
            const active = pathname === item.href || (item.href === "/responses" && pathname.startsWith("/responses/"));
            return (
              <div key={item.href} className="flex items-center gap-2">
                <Link href={item.href} className={clsx("font-semibold", active ? "text-accent" : "text-muted hover:text-ink")}>{item.label}</Link>
                {index < stageItems.length - 1 && <span>→</span>}
              </div>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
