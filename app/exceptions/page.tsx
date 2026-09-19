import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { buildDemoComparisonDataset } from "@/lib/extraction/comparison-source";
import type { ComparisonException, NormalizedVendorQuote } from "@/lib/domain/comparison";
import type { ExceptionCode } from "@/lib/domain/types";
import { procurementEvent } from "@/lib/fixtures/procurement-event";

export const dynamic = "force-dynamic";

type ExceptionsPageProps = {
  searchParams?: {
    filter?: string;
  };
};

const filters = [
  { key: "all", label: "All" },
  { key: "missing", label: "Missing quote" },
  { key: "unit", label: "Unit" },
  { key: "currency", label: "Currency" },
  { key: "freight", label: "Freight" },
  { key: "quality", label: "Quality" },
  { key: "ambiguous", label: "Ambiguous" }
];

export default async function ExceptionsPage({ searchParams }: ExceptionsPageProps) {
  const dataset = await buildDemoComparisonDataset();
  const activeFilter = searchParams?.filter ?? "all";
  const items = dataset.lines.flatMap((line) =>
    line.vendors
      .filter((cell) => cell.exceptions.length > 0)
      .map((cell) => ({ line, cell, primaryException: highestImpactException(cell.exceptions) }))
  ).filter(({ cell }) => cellMatchesFilter(cell, activeFilter));

  return (
    <AppShell
      title="Review Required"
      eyebrow="Exception work queue"
      description="Resolve supplier quote issues before relying on final scenario or decision outputs. Missing quotes are never treated as zero."
    >
      <section className="rounded-lg border border-line bg-white p-4 shadow-soft">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold">{items.length} issues need attention</h2>
            <p className="text-sm text-muted">Filter the queue by the type of procurement review needed.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {filters.map((filter) => (
              <Link
                key={filter.key}
                href={filter.key === "all" ? "/exceptions" : `/exceptions?filter=${filter.key}`}
                className={`rounded-md border px-3 py-2 text-sm font-semibold ${
                  activeFilter === filter.key ? "border-accent bg-accent text-white" : "border-line text-muted hover:border-accent hover:text-accent"
                }`}
              >
                {filter.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4">
        {items.map(({ line, cell, primaryException }) => {
          const documentId = procurementEvent.documents.find((document) => document.vendorId === cell.vendorId)?.id ?? "doc-a";
          return (
            <article key={`${line.rfxLineId}-${cell.vendorId}-${primaryException.code}`} className="rounded-lg border border-line bg-white p-5 shadow-soft">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={labelForCode(primaryException.code)} tone={primaryException.severity === "HIGH" ? "danger" : "warning"} />
                    <StatusBadge status={cell.reviewState === "BLOCKED" ? "Blocked" : "Review"} tone={cell.reviewState === "BLOCKED" ? "danger" : "warning"} />
                  </div>
                  <h2 className="mt-3 text-lg font-semibold">{cell.vendorName}</h2>
                  <p className="text-sm text-muted">Line {line.lineNumber} - {line.description}</p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/responses/${documentId}`} className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-muted hover:border-accent hover:text-accent">
                    Review response
                  </Link>
                  <Link href={`/comparison?filter=${cell.quoteStatus === "NOT_QUOTED" ? "not-quoted" : "review"}`} className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800">
                    Open comparison
                  </Link>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1fr_1fr]">
                <div className="rounded-md border border-line bg-panel p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted">Vendor quote</div>
                  <div className="mt-2 text-sm font-semibold">
                    {cell.quoteStatus === "NOT_QUOTED" ? "Not quoted" : `${cell.original.unitPrice ?? "Missing"} ${cell.original.currency ?? "UNKNOWN"} / ${cell.original.unit ?? "UNKNOWN"}`}
                  </div>
                  <p className="mt-1 text-xs text-muted">{cell.original.description ?? "No supplier line was extracted for this RFx line."}</p>
                </div>
                <div className="rounded-md border border-line bg-panel p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted">Problem</div>
                  <p className="mt-2 text-sm">{primaryException.message}</p>
                  <p className="mt-1 text-xs text-muted">{impactFor(primaryException.code)}</p>
                </div>
                <div className="rounded-md border border-line bg-panel p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted">Source evidence</div>
                  {cell.evidence[0] ? (
                    <div className="mt-2 text-sm">
                      <div className="font-semibold">{cell.evidence[0].sourceLocation}</div>
                      <div className="mt-1 text-xs text-muted">
                        {cell.evidence[0].sheet ? `Sheet ${cell.evidence[0].sheet} ` : ""}
                        {cell.evidence[0].cell ? `Cell ${cell.evidence[0].cell} ` : ""}
                        {cell.evidence[0].page ? `Page ${cell.evidence[0].page} ` : ""}
                        {cell.evidence[0].line ? `Line ${cell.evidence[0].line} ` : ""}
                      </div>
                      <p className="mt-2 text-xs text-muted">{cell.evidence[0].text}</p>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted">No source evidence is available for this item.</p>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </AppShell>
  );
}

function highestImpactException(exceptions: ComparisonException[]): ComparisonException {
  return [...exceptions].sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0];
}

function severityRank(severity: ComparisonException["severity"]) {
  return severity === "HIGH" ? 3 : severity === "MEDIUM" ? 2 : 1;
}

function cellMatchesFilter(cell: NormalizedVendorQuote, filter: string): boolean {
  if (filter === "missing") return cell.exceptions.some((exception) => exception.code === "MISSING_QUOTE");
  if (filter === "unit") return cell.exceptions.some((exception) => ["UNKNOWN_UNIT", "AMBIGUOUS_UNIT", "UNKNOWN_PACK_SIZE", "UNIT_CONVERSION_REQUIRED"].includes(exception.code));
  if (filter === "currency") return cell.exceptions.some((exception) => ["MISSING_CURRENCY", "AMBIGUOUS_CURRENCY"].includes(exception.code));
  if (filter === "freight") return cell.exceptions.some((exception) => ["MISSING_FREIGHT", "AMBIGUOUS_FREIGHT", "FREIGHT_AMBIGUOUS"].includes(exception.code));
  if (filter === "quality") return cell.exceptions.some((exception) => exception.code === "QUALITY_FAILURE");
  if (filter === "ambiguous") return cell.quoteStatus === "AMBIGUOUS" || cell.exceptions.some((exception) => exception.code.includes("AMBIGUOUS"));
  return true;
}

function labelForCode(code: ExceptionCode): string {
  return code.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function impactFor(code: ExceptionCode): string {
  if (code === "MISSING_QUOTE") return "The supplier cannot be compared for this RFx line. The value remains missing, not zero.";
  if (["UNKNOWN_UNIT", "AMBIGUOUS_UNIT", "UNKNOWN_PACK_SIZE", "UNIT_CONVERSION_REQUIRED"].includes(code)) return "The system cannot safely normalize this value to the RFx unit without buyer review.";
  if (["MISSING_CURRENCY", "AMBIGUOUS_CURRENCY"].includes(code)) return "The system cannot convert the price to the RFx base currency.";
  if (["MISSING_FREIGHT", "AMBIGUOUS_FREIGHT", "FREIGHT_AMBIGUOUS"].includes(code)) return "The landed cost may change once freight treatment is confirmed.";
  if (code === "QUALITY_FAILURE") return "The supplier may be excluded from quality-constrained sourcing scenarios.";
  return "This issue affects comparison confidence and should be reviewed before final approval.";
}
