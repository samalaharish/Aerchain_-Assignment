import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { formatComparisonMoney, type NormalizedVendorQuote } from "@/lib/domain/comparison";
import { getSupplierCoverage } from "@/lib/domain/analyst-tools";
import { buildDemoComparisonDataset } from "@/lib/extraction/comparison-source";
import { procurementEvent } from "@/lib/fixtures/procurement-event";

export const dynamic = "force-dynamic";

type ComparisonPageProps = {
  searchParams?: {
    filter?: string;
  };
};

const filters = [
  { key: "all", label: "All" },
  { key: "ready", label: "Comparable" },
  { key: "review", label: "Needs review" },
  { key: "not-quoted", label: "Not quoted" },
  { key: "ambiguous", label: "Ambiguous" }
];

export default async function ComparisonPage({ searchParams }: ComparisonPageProps) {
  const dataset = await buildDemoComparisonDataset();
  const activeFilter = searchParams?.filter ?? "all";
  const lines = dataset.lines.filter((line) => lineMatchesFilter(line.vendors, activeFilter));
  const supplierCoverage = getSupplierCoverage(dataset);

  return (
    <AppShell
      title="Supplier Comparison"
      eyebrow="Comparison-ready procurement facts"
      description="Validated extraction outputs are normalized by deterministic code. Original supplier values, evidence, and exceptions remain visible for review."
    >
      <section className="grid gap-3 md:grid-cols-4">
        <Metric label="RFx lines" value={`${dataset.metrics.totalRfxLines}`} detail={`${dataset.metrics.vendorCount} suppliers`} />
        <Metric label="Comparable lines" value={`${dataset.metrics.rfxLinesWithComparableQuote}/${dataset.metrics.totalRfxLines}`} detail="At least one comparable supplier" />
        <Metric label="Comparable supplier quotes" value={`${dataset.metrics.comparableSupplierQuotes}/${dataset.metrics.supplierLineCells}`} detail="Supplier-line cells" />
        <Metric label="Need review" value={`${dataset.metrics.supplierQuotesNeedReview}`} detail={`${dataset.metrics.notQuotedSupplierQuotes} not quoted`} />
      </section>

      <section className="rounded-lg border border-line bg-white p-4 shadow-soft">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold">Supplier coverage</h2>
            <p className="text-sm text-muted">
              Base currency {dataset.baseCurrency}. FX source: {dataset.fxAssumption.source} ({dataset.fxAssumption.timestamp}).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {filters.map((filter) => (
              <Link
                key={filter.key}
                href={filter.key === "all" ? "/comparison" : `/comparison?filter=${filter.key}`}
                className={`rounded-md border px-3 py-2 text-sm font-semibold ${
                  activeFilter === filter.key ? "border-accent bg-accent text-white" : "border-line text-muted hover:border-accent hover:text-accent"
                }`}
              >
                {filter.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          {supplierCoverage.map((supplier) => (
            <div key={supplier.vendorId} className="rounded-md border border-line bg-panel p-3">
              <div className="truncate text-sm font-semibold">{supplier.vendorName}</div>
              <div className="mt-2 text-xs text-muted">Coverage</div>
              <div className="text-sm font-semibold">{supplier.quoted}/30 quoted</div>
              <div className="mt-1 text-xs text-muted">{supplier.ready} comparable - {supplier.review} review</div>
            </div>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-line bg-white shadow-soft">
        <div className="border-b border-line p-4">
          <h2 className="font-semibold">30 RFx lines x 5 suppliers</h2>
          <p className="text-sm text-muted">No award recommendation is shown. This view establishes comparability, review status, and evidence.</p>
        </div>
        <div className="max-h-[72vh] overflow-auto">
          <table className="min-w-[1420px] border-separate border-spacing-0 text-left text-sm">
            <thead className="sticky top-0 z-20 bg-panel text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="sticky left-0 z-30 w-[280px] border-b border-line bg-panel px-4 py-3">RFx line</th>
                {procurementEvent.vendors.map((vendor) => (
                  <th key={vendor.id} className="w-[220px] border-b border-line px-4 py-3">{vendor.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.rfxLineId} className="align-top">
                  <td className="sticky left-0 z-10 border-b border-line bg-white px-4 py-3">
                    <div className="font-semibold">{line.lineNumber}. {line.description}</div>
                    <div className="mt-1 text-xs text-muted">
                      {line.sku} - Requested {line.requestedQuantity.toLocaleString("en-IN")} {line.requestedUnit}
                    </div>
                  </td>
                  {line.vendors.map((cell) => (
                    <td key={`${line.rfxLineId}-${cell.vendorId}`} className="border-b border-line px-4 py-3">
                      <ComparisonCell cell={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-soft">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted">{detail}</div>
    </div>
  );
}

function ComparisonCell({ cell }: { cell: NormalizedVendorQuote }) {
  const tone = cell.reviewState === "READY" ? "success" : cell.reviewState === "BLOCKED" ? "danger" : "warning";
  const primary = cell.quoteStatus === "NOT_QUOTED"
    ? "Not quoted"
    : cell.normalized.landedUnitCost !== null
      ? `${formatComparisonMoney(cell.normalized.landedUnitCost, cell.normalized.currency)} / piece`
      : cell.normalized.unitPrice !== null
        ? `${formatComparisonMoney(cell.normalized.unitPrice, cell.normalized.currency)} / piece material`
        : "Unresolved";

  return (
    <div className="min-h-[112px] space-y-2">
      <div className="flex flex-wrap gap-2">
        <StatusBadge status={cell.reviewState === "READY" ? "Comparable" : cell.reviewState === "BLOCKED" ? "Blocked" : "Review"} tone={tone} />
        {cell.quoteStatus !== "QUOTED" && <StatusBadge status={cell.quoteStatus === "NOT_QUOTED" ? "Not quoted" : "Ambiguous"} tone={cell.quoteStatus === "NOT_QUOTED" ? "danger" : "warning"} />}
      </div>
      <div className="font-semibold leading-snug">{primary}</div>
      {cell.original.unitPrice !== null && (
        <div className="text-xs text-muted">
          Original: {cell.original.unitPrice} {cell.original.currency ?? "UNKNOWN"} / {cell.original.unit ?? "UNKNOWN"}
        </div>
      )}
      {cell.normalized.materialExtendedPrice !== null && (
        <div className="text-xs text-muted">Material: {formatComparisonMoney(cell.normalized.materialExtendedPrice, cell.normalized.currency)}</div>
      )}
      {cell.normalized.freightUnitCost !== null ? (
        <div className="text-xs text-muted">Freight: {formatComparisonMoney(cell.normalized.freightUnitCost, cell.normalized.currency)} / piece</div>
      ) : (
        <div className="text-xs text-muted">Freight: {cell.freight.kind}</div>
      )}
      {cell.exceptions.length > 0 && (
        <div className="text-xs text-amber-700">{cell.exceptions.map((item) => item.code).join(", ")}</div>
      )}
      {cell.evidence.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer font-semibold text-accent">Evidence</summary>
          <div className="mt-2 space-y-2 rounded-md border border-line bg-panel p-2">
            {cell.evidence.slice(0, 2).map((evidence, index) => (
              <div key={`${evidence.sourceLocation}-${index}`}>
                <div className="font-medium">{evidence.sourceLocation}</div>
                <div className="text-muted">
                  {evidence.sheet ? `Sheet ${evidence.sheet} ` : ""}
                  {evidence.cell ? `Cell ${evidence.cell} ` : ""}
                  {evidence.page ? `Page ${evidence.page} ` : ""}
                  {evidence.line ? `Line ${evidence.line} ` : ""}
                </div>
                <div className="mt-1 text-muted">{evidence.text}</div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function lineMatchesFilter(vendors: NormalizedVendorQuote[], filter: string): boolean {
  if (filter === "ready") return vendors.some((cell) => cell.reviewState === "READY");
  if (filter === "review") return vendors.some((cell) => cell.reviewState !== "READY" && cell.quoteStatus !== "NOT_QUOTED");
  if (filter === "not-quoted") return vendors.some((cell) => cell.quoteStatus === "NOT_QUOTED");
  if (filter === "ambiguous") return vendors.some((cell) => cell.quoteStatus === "AMBIGUOUS" || cell.exceptions.some((item) => item.code.includes("AMBIGUOUS")));
  return true;
}
