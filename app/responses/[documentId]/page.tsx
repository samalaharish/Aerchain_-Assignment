import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { runFixtureExtractionWorkflow } from "@/lib/extraction/workflow";
import { procurementEvent } from "@/lib/fixtures/procurement-event";

export const dynamic = "force-dynamic";

type PageProps = {
  params: {
    documentId: string;
  };
};

export default async function ExtractionReviewPage({ params }: PageProps) {
  const document = procurementEvent.documents.find((item) => item.id === params.documentId);
  if (!document) {
    notFound();
  }

  const vendor = procurementEvent.vendors.find((item) => item.id === document.vendorId);
  const result = await runFixtureExtractionWorkflow(params.documentId);
  const quotedCount = result.extraction?.lineItems.filter((line) => line.status === "QUOTED").length ?? 0;
  const notQuotedCount = result.extraction?.lineItems.filter((line) => line.status === "NOT_QUOTED").length ?? 0;
  const reviewCount = result.extraction?.lineItems.filter((line) => line.status === "AMBIGUOUS").length ?? 0;
  const providerLabel = result.run.provider === "demo"
    ? "Demo extraction - simulated provider"
    : result.run.provider === "gemini"
      ? "AI extraction - provider: Gemini"
      : result.run.provider === "openai"
        ? "AI extraction - provider: OpenAI"
        : "Deterministic extraction";

  return (
    <AppShell
      title={vendor?.name ?? "Supplier response"}
      eyebrow={`Supplier response - ${document.sourceType}`}
      description="Review extracted quote lines, confidence, status, and source evidence before relying on the supplier data for comparison."
    >
      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Vendor</div>
            <div className="mt-1 font-semibold">{vendor?.name}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Document</div>
            <div className="mt-1 font-semibold">{document.filename}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Processing</div>
            <div className="mt-1">
              <StatusBadge status={result.status} tone={result.status === "EXTRACTED" ? "success" : result.status === "AI_PENDING" ? "warning" : "danger"} />
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Provider</div>
            <div className="mt-1 font-semibold">{providerLabel}</div>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted">{result.reason}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <StatusBadge status={`${quotedCount} quoted`} tone="success" />
          <StatusBadge status={`${notQuotedCount} not quoted`} tone={notQuotedCount > 0 ? "danger" : "neutral"} />
          <StatusBadge status={`${reviewCount} ambiguous`} tone={reviewCount > 0 ? "warning" : "neutral"} />
          <StatusBadge status={result.run.provider ? `Provider: ${result.run.provider}` : "No provider"} tone={result.run.provider ? "success" : "warning"} />
        </div>
        {result.run.error && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{result.run.error}</div>
        )}
      </section>

      {(result.extraction?.qualityResponses.length ?? 0) > 0 && (
        <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold">Quality questionnaire</h2>
              <p className="mt-1 text-sm text-muted">Quality answers are used by quality-filtered scenarios and remain reviewable with evidence.</p>
            </div>
            <StatusBadge status={vendor?.qualityStatus ?? "NOT_EVALUATED"} tone={vendor?.qualityStatus === "PASS" ? "success" : vendor?.qualityStatus === "FAIL" ? "danger" : "warning"} />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {result.extraction?.qualityResponses.map((answer) => (
              <div key={answer.questionCode} className="rounded-md border border-line bg-panel p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{answer.question}</div>
                    <div className="mt-1 text-sm text-muted">{answer.answer ?? "No answer provided"}</div>
                  </div>
                  <StatusBadge status={answer.status} tone={answer.status === "PASS" ? "success" : answer.status === "FAIL" ? "danger" : "warning"} />
                </div>
                {answer.evidence[0] && (
                  <details className="mt-3 text-xs">
                    <summary className="cursor-pointer font-semibold text-accent">Evidence</summary>
                    <p className="mt-2 text-muted">{answer.evidence[0].text}</p>
                  </details>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-lg border border-line bg-white shadow-soft">
        <div className="border-b border-line p-4">
          <h2 className="font-semibold">Extracted line items</h2>
          <p className="text-sm text-muted">Evidence is shown when available. Missing and ambiguous values are not converted to zero.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1180px] text-left text-sm">
            <thead className="bg-panel text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">RFx line</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Vendor description</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Lead time</th>
                <th className="px-4 py-3">Confidence</th>
                <th className="px-4 py-3">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {(result.extraction?.lineItems ?? []).map((line) => {
                const rfxLine = procurementEvent.lineItems.find((item) => item.id === line.rfxLineId);
                const evidence = line.evidence[0] ?? line.freight.evidence[0];
                return (
                  <tr key={line.rfxLineId} className="border-t border-line align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium">{rfxLine?.lineNumber}. {rfxLine?.description}</div>
                      <div className="text-xs text-muted">{line.rfxLineId}</div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={line.status === "QUOTED" ? "Quoted" : line.status === "AMBIGUOUS" ? "Ambiguous" : "Not quoted"} tone={line.status === "QUOTED" ? "success" : line.status === "AMBIGUOUS" ? "warning" : "neutral"} />
                    </td>
                    <td className="px-4 py-3">{line.vendorDescription ?? "Not quoted"}</td>
                    <td className="px-4 py-3">{line.unitPrice === null ? "Missing" : `${line.unitPrice} ${line.currency ?? "UNKNOWN"}`}</td>
                    <td className="px-4 py-3">{line.quotedUnit ?? "Missing"}</td>
                    <td className="px-4 py-3">{line.quotedQuantity ?? "Missing"}</td>
                    <td className="px-4 py-3">{line.leadTimeDays === null ? "Missing" : `${line.leadTimeDays} days`}</td>
                    <td className="px-4 py-3">{line.confidence}</td>
                    <td className="px-4 py-3">
                      {evidence ? (
                        <details>
                          <summary className="cursor-pointer font-semibold text-accent">Evidence</summary>
                          <div className="mt-2 rounded-md border border-line bg-panel p-3">
                            <div className="font-medium">{evidence.sourceLocation}</div>
                            <div className="mt-1 text-xs text-muted">
                              {evidence.sheet ? `Sheet ${evidence.sheet} ` : ""}
                              {evidence.cell ? `Cell ${evidence.cell} ` : ""}
                              {evidence.page ? `Page ${evidence.page} ` : ""}
                              {evidence.line ? `Line ${evidence.line} ` : ""}
                              Parser: {evidence.parser}
                            </div>
                            <div className="mt-2 max-w-sm text-xs text-muted">{evidence.text}</div>
                          </div>
                        </details>
                      ) : (
                        <span className="text-muted">No evidence available</span>
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
