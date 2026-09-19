import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { procurementEvent } from "@/lib/fixtures/procurement-event";
import { generateExceptionsForEvent } from "@/lib/domain/exceptions";
import { processSeededVendorDocuments } from "@/lib/ingestion/fixture-processing";
import { getExtractionProviderLabel, getExtractionProviderMode } from "@/lib/extraction/config";
import { buildDemoComparisonDataset } from "@/lib/extraction/comparison-source";
import { getSupplierCoverage } from "@/lib/domain/analyst-tools";

export const dynamic = "force-dynamic";

export default async function ResponsesPage() {
  const exceptions = generateExceptionsForEvent(procurementEvent);
  const processing = await processSeededVendorDocuments();
  const dataset = await buildDemoComparisonDataset();
  const coverage = getSupplierCoverage(dataset);
  const providerMode = getExtractionProviderMode();
  const providerLabel = providerMode === "demo" ? "Demo extraction" : `AI extraction - ${getExtractionProviderLabel()}`;

  return (
    <AppShell
      title="Supplier Responses"
      eyebrow="Response work queue"
      description="Track supplier response coverage, extraction status, and review needs."
    >
      <section className="rounded-lg border border-line bg-white p-4 shadow-soft">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Supplier responses</div>
            <div className="mt-1 text-sm font-semibold">5 responses received - {providerLabel}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status="All" />
            <StatusBadge status="Ready" tone="success" />
            <StatusBadge status="Needs review" tone="warning" />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-line bg-white shadow-soft">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-panel text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Format</th>
                <th className="px-4 py-3">Extraction</th>
                <th className="px-4 py-3">Coverage</th>
                <th className="px-4 py-3">Quality</th>
                <th className="px-4 py-3">Review</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {procurementEvent.vendors.map((vendor) => {
                const response = procurementEvent.responses.find((item) => item.vendorId === vendor.id);
                const vendorExceptions = exceptions.filter((item) => item.vendorId === vendor.id);
                const processingSummary = processing.find((item) => item.vendorId === vendor.id);
                const supplierCoverage = coverage.find((item) => item.vendorId === vendor.id);
                const reviewCount = supplierCoverage?.review ?? vendorExceptions.length;
                const extractionLabel = vendor.id === "vendor-a" ? "Deterministic" : providerMode === "demo" && ["vendor-d", "vendor-e"].includes(vendor.id) ? "Demo extraction" : `${getExtractionProviderLabel()} extraction`;

                return (
                  <tr key={vendor.id} className="border-t border-line align-top">
                    <td className="px-4 py-3">
                      <div className="font-semibold">{vendor.name}</div>
                      <div className="text-xs text-muted">{response?.messinessNotes.join(" ")}</div>
                    </td>
                    <td className="px-4 py-3">{processingSummary?.filename ?? response?.format}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={extractionLabel} tone={vendor.id === "vendor-a" ? "success" : "warning"} />
                    </td>
                    <td className="px-4 py-3">{supplierCoverage?.quoted ?? 0} / 30</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={vendor.qualityStatus.replace("_", " ")} tone={vendor.qualityStatus === "PASS" ? "success" : vendor.qualityStatus === "FAIL" ? "danger" : "warning"} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        status={reviewCount > 0 ? `${reviewCount} issues` : "Ready"}
                        tone={reviewCount > 0 ? "warning" : "success"}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {response && (
                        <Link
                          href={`/responses/${response.documentId}`}
                          className="inline-flex rounded-md border border-accent px-3 py-2 text-sm font-semibold text-accent hover:bg-accent hover:text-white"
                        >
                          Review response
                        </Link>
                      )}
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
