import Link from "next/link";
import { AlertTriangle, Bot, FileSearch, GitCompare, Inbox } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/status-badge";
import { buildDemoComparisonDataset } from "@/lib/extraction/comparison-source";
import { getSupplierCoverage } from "@/lib/domain/analyst-tools";
import { procurementEvent } from "@/lib/fixtures/procurement-event";
import type { ExceptionCode } from "@/lib/domain/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const dataset = await buildDemoComparisonDataset();
  const coverage = getSupplierCoverage(dataset);
  const attention = dataset.metrics.supplierQuotesNeedReview;
  const readinessPct = Math.round((dataset.metrics.rfxLinesWithComparableQuote / dataset.metrics.totalRfxLines) * 100);
  const issueSummary = summarizeIssues(dataset.lines.flatMap((line) => line.vendors.flatMap((cell) => cell.exceptions.map((item) => item.code))));

  return (
    <AppShell
      title="Corrugated Packaging RFx"
      eyebrow="Procurement workspace"
      description="Turn five supplier responses into comparable facts, reviewed exceptions, and a defensible sourcing decision."
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Suppliers" value="5" detail="Responses received" />
        <MetricCard label="RFx lines" value="30" detail={`${dataset.metrics.supplierLineCells} supplier quote cells`} />
        <MetricCard label="Comparable coverage" value={`${dataset.metrics.rfxLinesWithComparableQuote}/30`} detail={`${readinessPct}% of requested lines`} tone="success" />
        <MetricCard label="Supplier quote readiness" value={`${dataset.metrics.comparableSupplierQuotes}/${dataset.metrics.supplierLineCells}`} detail={`${dataset.metrics.notQuotedSupplierQuotes} not quoted, ${attention} need review`} tone={attention > 0 ? "warning" : "success"} />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Decision readiness</h2>
              <p className="mt-1 text-sm text-muted">{dataset.metrics.rfxLinesWithComparableQuote} of 30 RFx lines have at least one comparable supplier.</p>
            </div>
            <StatusBadge status={`${readinessPct}% comparable coverage`} tone={readinessPct >= 80 ? "success" : "warning"} />
          </div>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-panel">
            <div className="h-full rounded-full bg-accent" style={{ width: `${readinessPct}%` }} />
          </div>
          <p className="mt-3 text-sm text-muted">
            {attention} supplier quotes still need buyer review. Missing supplier quotes are tracked separately and never treated as zero.
          </p>
        </div>

        <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <h2 className="text-lg font-semibold">Next actions</h2>
          <div className="mt-4 grid gap-2">
            <Action href="/exceptions" icon={AlertTriangle} label={`Review ${attention} unresolved quote issues`} detail={issueSummary} />
            <Action href="/comparison" icon={GitCompare} label="Compare supplier landed costs" detail={`${dataset.metrics.comparableSupplierQuotes} comparable supplier quotes`} />
            <Action href="/analyst" icon={Bot} label="Ask Procurement Analyst" detail="Get a grounded summary with evidence and caveats" />
            <Action href="/scenarios" icon={Inbox} label="Run sourcing scenario" detail="Evaluate deterministic goal-based scenarios" />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-line bg-white shadow-soft">
        <div className="border-b border-line p-4">
          <h2 className="font-semibold">Supplier response status</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-panel text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Coverage</th>
                <th className="px-4 py-3">Comparable</th>
                <th className="px-4 py-3">Review</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {coverage.map((supplier) => {
                return (
                  <tr key={supplier.vendorId} className="border-t border-line">
                    <td className="px-4 py-3 font-medium">{supplier.vendorName}</td>
                    <td className="px-4 py-3">{supplier.quoted} / 30</td>
                    <td className="px-4 py-3">{supplier.ready}</td>
                    <td className="px-4 py-3">{supplier.review}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={supplier.review === 0 ? "Ready" : "Review"} tone={supplier.review === 0 ? "success" : "warning"} />
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/responses/${procurementEvent.documents.find((item) => item.vendorId === supplier.vendorId)?.id ?? "doc-a"}`} className="font-semibold text-accent hover:underline">
                        Review
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}

function summarizeIssues(codes: ExceptionCode[]): string {
  const unit = codes.filter((code) => ["UNKNOWN_PACK_SIZE", "UNIT_CONVERSION_REQUIRED", "AMBIGUOUS_UNIT", "UNKNOWN_UNIT"].includes(code)).length;
  const missing = codes.filter((code) => code === "MISSING_QUOTE").length;
  const freight = codes.filter((code) => ["FREIGHT_AMBIGUOUS", "AMBIGUOUS_FREIGHT", "MISSING_FREIGHT"].includes(code)).length;
  const currency = codes.filter((code) => ["MISSING_CURRENCY", "AMBIGUOUS_CURRENCY"].includes(code)).length;
  const parts = [
    unit ? `${unit} unit or pack` : null,
    missing ? `${missing} missing quote` : null,
    freight ? `${freight} freight` : null,
    currency ? `${currency} currency` : null
  ].filter(Boolean);
  return parts.length ? parts.join(" - ") : "No unresolved quote issues";
}

function Action({ href, icon: Icon, label, detail }: { href: string; icon: typeof FileSearch; label: string; detail: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-md border border-line bg-panel px-3 py-3 transition hover:border-accent hover:bg-white">
      <Icon className="h-4 w-4 text-accent" aria-hidden="true" />
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-muted">{detail}</span>
      </span>
    </Link>
  );
}
