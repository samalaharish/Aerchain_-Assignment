import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { DecisionActions } from "@/components/decision-actions";
import { StatusBadge } from "@/components/status-badge";
import { formatComparisonMoney } from "@/lib/domain/comparison";
import { createDecisionRecord } from "@/lib/domain/decision";
import { calculateScenarios } from "@/lib/domain/scenarios";
import { buildDemoComparisonDataset } from "@/lib/extraction/comparison-source";

export const dynamic = "force-dynamic";

export default async function ApprovalPage() {
  const dataset = await buildDemoComparisonDataset();
  const scenarios = calculateScenarios(dataset);
  const selected = scenarios.find((scenario) => scenario.goal === "QUALITY_APPROVED_ONLY") ?? scenarios[0];
  const unresolved = dataset.metrics.supplierQuotesNeedReview;
  const record = createDecisionRecord({
    dataset,
    scenario: selected,
    status: unresolved > 0 ? "DRAFT" : "READY_FOR_REVIEW"
  });

  return (
    <AppShell
      title="Decision"
      eyebrow="Human approval checkpoint"
      description="Review the selected analysis, assumptions, exceptions, and evidence before any buyer-approved sourcing decision."
    >
      <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Corrugated Packaging RFx</h2>
              <p className="mt-2 text-sm text-muted">Analysis used: {selected.name}</p>
            </div>
            <StatusBadge status={unresolved > 0 ? "Review before approval" : "Ready for approval"} tone={unresolved > 0 ? "warning" : "success"} />
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <Metric label="Comparable lines" value={`${dataset.metrics.rfxLinesWithComparableQuote}/30`} />
            <Metric label="Supplier quotes needing review" value={String(unresolved)} />
            <Metric label="Scenario coverage" value={`${selected.coverageLines}/30`} />
            <Metric label="Estimated cost" value={selected.estimatedCost === null ? "N/A" : formatComparisonMoney(selected.estimatedCost, selected.currency)} />
          </div>
        </div>

        <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <h2 className="font-semibold">Key facts</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>5 suppliers responded to 30 requested RFx lines.</li>
            <li>{dataset.metrics.notQuotedSupplierQuotes} supplier-line cells are not quoted.</li>
            <li>{unresolved} supplier quotes still require buyer review.</li>
            <li>Scenario calculations use only comparable quote cells.</li>
          </ul>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <h2 className="font-semibold">Assumptions</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {record.assumptions.map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <h2 className="font-semibold">Evidence</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {record.evidenceLinks.map((link, index) => (
              <Link
                key={link.href}
                href={link.href}
                className={`${index === 0 ? "bg-accent text-white hover:bg-teal-800" : "border border-line text-muted hover:border-accent hover:text-accent"} rounded-md px-3 py-2 text-sm font-semibold`}
              >
                {link.label}
              </Link>
            ))}
            <Link href="/scenarios" className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-muted hover:border-accent hover:text-accent">
              View scenarios
            </Link>
          </div>
        </div>
      </section>

      <DecisionActions initialRecord={record} />
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-panel p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}
