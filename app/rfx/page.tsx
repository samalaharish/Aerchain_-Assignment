import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { getActiveProcurementEvent } from "@/lib/rfx/active-event";
import { readReviewedRfxDraft } from "@/lib/rfx/draft-store";

export default async function RfxPage() {
  const procurementEvent = await getActiveProcurementEvent();
  const reviewedDraft = await readReviewedRfxDraft();

  return (
    <AppShell
      title="RFx Overview"
      eyebrow="Corrugated Packaging RFx"
      description="Review the buyer request, quantities, specifications, and required delivery dates before comparing supplier responses."
    >
      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-semibold">{procurementEvent.rfx.title}</h2>
            <p className="mt-1 text-sm text-muted">{procurementEvent.rfx.description}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted">
              <span>Category: {procurementEvent.rfx.category}</span>
              <span>•</span>
              <span>Base currency: {procurementEvent.rfx.baseCurrency}</span>
              <span>•</span>
              <span>Lines: {procurementEvent.lineItems.length}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/rfx/create" className="rounded-md border border-accent px-3 py-2 text-sm font-semibold text-accent hover:bg-accent hover:text-white">
              Create with copilot
            </Link>
            <StatusBadge status={procurementEvent.rfx.status} tone="success" />
          </div>
        </div>
        {reviewedDraft && (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            Reviewed RFx draft is active. Downstream comparison uses the reviewed line descriptions, quantities, and units where they map to the assignment RFx lines.
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-line bg-white shadow-soft">
        <div className="border-b border-line p-4">
          <h2 className="font-semibold">RFx line items</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-panel text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Line</th>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Spec</th>
                <th className="px-4 py-3">Quantity</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Need by</th>
              </tr>
            </thead>
            <tbody>
              {procurementEvent.lineItems.map((line) => (
                <tr key={line.id} className="border-t border-line">
                  <td className="px-4 py-3 font-medium">{line.lineNumber}</td>
                  <td className="px-4 py-3">{line.description}</td>
                  <td className="px-4 py-3 text-muted">{line.specification}</td>
                  <td className="px-4 py-3">{line.quantity.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3">{line.unit}</td>
                  <td className="px-4 py-3">{line.requiredBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
