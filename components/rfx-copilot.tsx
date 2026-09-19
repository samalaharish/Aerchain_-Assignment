"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import type { RfxDraft } from "@/lib/rfx/copilot";
import type { RfxWorkflowState } from "@/lib/rfx/workflow-state";

const defaultPrompt = "I need corrugated packaging for our West India fulfillment network. We need around 30 carton SKUs. Ask suppliers for pricing, MOQ, lead time, freight and quality information.";
type DraftLine = RfxDraft["lineItems"][number];

export function RfxCopilot() {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [draft, setDraft] = useState<RfxDraft | null>(null);
  const [pending, setPending] = useState(false);
  const [savePending, setSavePending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const [submitPending, setSubmitPending] = useState(false);
  const [submission, setSubmission] = useState<RfxWorkflowState | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/rfx-draft").then((response) => response.ok ? response.json() : null),
      fetch("/api/rfx-state").then((response) => response.ok ? response.json() : null)
    ])
      .then(([draftPayload, statePayload]: [{ draft?: RfxDraft | null } | null, { state?: RfxWorkflowState } | null]) => {
        if (!active) return;
        if (draftPayload?.draft) {
          setDraft(draftPayload.draft);
          setDraftSaved(true);
        }
        if (statePayload?.state?.status === "SENT") setSubmission(statePayload.state);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  async function generate() {
    setPending(true);
    setError(null);
    setSaveMessage(null);
    try {
      const response = await fetch("/api/rfx-copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });
      if (!response.ok) throw new Error(await response.text());
      setDraft(await response.json() as RfxDraft);
      setDraftSaved(false);
      setSubmission(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "RFx copilot failed.");
    } finally {
      setPending(false);
    }
  }

  async function saveReviewedDraft() {
    if (!draft) return;
    setSavePending(true);
    setError(null);
    setSaveMessage(null);
    try {
      const response = await fetch("/api/rfx-draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft })
      });
      if (!response.ok) throw new Error(await response.text());
      const payload = await response.json() as { draft: RfxDraft };
      setDraft(payload.draft);
      setDraftSaved(true);
      setSaveMessage("RFx draft saved. Review is complete enough to submit to suppliers.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the reviewed RFx draft.");
    } finally {
      setSavePending(false);
    }
  }

  async function submitRfx() {
    setSubmitPending(true);
    setError(null);
    setSaveMessage(null);
    try {
      const response = await fetch("/api/rfx-submit", { method: "POST" });
      if (!response.ok) throw new Error(await response.text());
      const payload = await response.json() as { state: RfxWorkflowState };
      setSubmission(payload.state);
      setSaveMessage("RFx submitted to suppliers. Email delivery is simulated for this prototype.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit the RFx.");
    } finally {
      setSubmitPending(false);
    }
  }

  function updateDraft(patch: Partial<RfxDraft>) {
    setDraft((current) => current ? { ...current, ...patch } : current);
    setSaveMessage(null);
    setDraftSaved(false);
    setSubmission(null);
  }

  function updateLine(lineNumber: number, patch: Partial<DraftLine>) {
    setDraft((current) => current ? {
      ...current,
      lineItems: current.lineItems.map((line) => line.lineNumber === lineNumber ? { ...line, ...patch } : line)
    } : current);
    setSaveMessage(null);
    setDraftSaved(false);
    setSubmission(null);
  }

  function addLine() {
    setDraft((current) => {
      if (!current) return current;
      const nextLineNumber = Math.max(0, ...current.lineItems.map((line) => line.lineNumber)) + 1;
      return {
        ...current,
        lineItems: [
          ...current.lineItems,
          {
            lineNumber: nextLineNumber,
            description: "New line item",
            quantity: null,
            unit: null,
            specification: null,
            deliveryLocation: null
          }
        ],
        assumptions: Array.from(new Set([
          ...current.assumptions,
          "Buyer-added or edited RFx lines must be reviewed before sending to suppliers."
        ]))
      };
    });
    setSaveMessage(null);
    setDraftSaved(false);
    setSubmission(null);
  }

  function removeLine(lineNumber: number) {
    setDraft((current) => current ? {
      ...current,
      lineItems: current.lineItems.filter((line) => line.lineNumber !== lineNumber)
    } : current);
    setSaveMessage(null);
    setDraftSaved(false);
    setSubmission(null);
  }

  const validation = draft ? validateDraft(draft) : [];
  const hasBlockedValidation = validation.some((item) => item.state === "BLOCKED");

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">RFx Copilot</h2>
            <p className="mt-1 text-sm text-muted">Describe the sourcing need. The copilot drafts structure; the buyer reviews and edits before sending.</p>
          </div>
          <StatusBadge status="Buyer review required" tone="warning" />
        </div>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          className="mt-4 min-h-[120px] w-full rounded-md border border-line bg-panel p-3 text-sm outline-none focus:border-accent"
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={generate}
            disabled={pending}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {pending ? "Drafting..." : "Generate RFx draft"}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        {saveMessage && <p className="mt-3 text-sm text-emerald-700">{saveMessage}</p>}
      </section>

      {draft && (
        <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">{draft.status === "DRAFT_READY" ? "Structured RFx draft" : "Clarification needed"}</h2>
              <p className="mt-1 text-sm text-muted">
                Provider: {draft.provider === "openai" ? `OpenAI (${draft.model})` : "Demo copilot - simulated draft"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={draft.status === "DRAFT_READY" ? "Draft ready" : "Needs clarification"} tone={draft.status === "DRAFT_READY" ? "success" : "warning"} />
              <StatusBadge status="Buyer review required" tone="warning" />
            </div>
          </div>

          {draft.clarificationQuestions.length > 0 && (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4">
              <h3 className="font-semibold text-amber-900">Minimum clarification questions</h3>
              <ul className="mt-2 space-y-1 text-sm text-amber-800">
                {draft.clarificationQuestions.map((question) => <li key={question}>{question}</li>)}
              </ul>
            </div>
          )}

          {draft.assumptions.length > 0 && (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4">
              <h3 className="font-semibold">Editable assumptions</h3>
              <p className="mt-1 text-sm text-amber-800">
                Generated or inferred values are assumptions until the buyer edits or confirms them. They are not sent as authoritative requirements until this draft is saved.
              </p>
              <ul className="mt-2 space-y-1 text-sm text-muted">
                {draft.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}
              </ul>
            </div>
          )}

          <div className="mt-5 grid gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted" htmlFor="rfx-scope">Scope</label>
            <textarea
              id="rfx-scope"
              value={draft.scope ?? ""}
              onChange={(event) => updateDraft({ scope: event.target.value || null })}
              className="min-h-[72px] rounded-md border border-line bg-white p-3 text-sm outline-none focus:border-accent"
              placeholder="Describe the sourcing scope."
            />
          </div>

          {draft.lineItems.length > 0 && (
            <div className="mt-5 overflow-x-auto">
              <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="font-semibold">RFx line items</h3>
                  <p className="text-sm text-muted">Edit each generated line before saving the reviewed RFx draft.</p>
                </div>
                <button
                  type="button"
                  onClick={addLine}
                  className="w-fit rounded-md border border-line px-3 py-2 text-sm font-semibold hover:border-accent hover:text-accent"
                >
                  Add line
                </button>
              </div>
              <table className="min-w-[1120px] text-left text-sm">
                <thead className="bg-panel text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-3 py-2">Line</th>
                    <th className="px-3 py-2">Item / name</th>
                    <th className="px-3 py-2">Quantity <span className="normal-case text-amber-700">(assumption)</span></th>
                    <th className="px-3 py-2">Unit</th>
                    <th className="px-3 py-2">Specification <span className="normal-case text-amber-700">(assumption)</span></th>
                    <th className="px-3 py-2">Delivery requirement <span className="normal-case text-amber-700">(assumption)</span></th>
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.lineItems.map((line) => (
                    <tr key={line.lineNumber} className="border-t border-line">
                      <td className="px-3 py-2 font-medium">{line.lineNumber}</td>
                      <td className="px-3 py-2">
                        <input
                          value={line.description}
                          onChange={(event) => updateLine(line.lineNumber, { description: event.target.value })}
                          className="w-full rounded-md border border-line bg-white px-2 py-1.5 outline-none focus:border-accent"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="1"
                          inputMode="decimal"
                          value={line.quantity ?? ""}
                          onChange={(event) => {
                            const value = event.target.value ? Number(event.target.value) : null;
                            updateLine(line.lineNumber, { quantity: value && value > 0 ? value : null });
                          }}
                          className="w-28 rounded-md border border-line bg-white px-2 py-1.5 outline-none focus:border-accent"
                          placeholder="Needs input"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={line.unit ?? ""}
                          onChange={(event) => updateLine(line.lineNumber, { unit: event.target.value || null })}
                          className="w-32 rounded-md border border-line bg-white px-2 py-1.5 outline-none focus:border-accent"
                          placeholder="unit"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={line.specification ?? ""}
                          onChange={(event) => updateLine(line.lineNumber, { specification: event.target.value || null })}
                          className="w-full rounded-md border border-line bg-white px-2 py-1.5 outline-none focus:border-accent"
                          placeholder="Needs input"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={line.deliveryLocation ?? ""}
                          onChange={(event) => updateLine(line.lineNumber, { deliveryLocation: event.target.value || null })}
                          className="w-full rounded-md border border-line bg-white px-2 py-1.5 outline-none focus:border-accent"
                          placeholder="Needs input"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => removeLine(line.lineNumber)}
                          className="rounded-md border border-line px-2 py-1 text-xs font-semibold text-muted hover:border-red-300 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <EditableSummary title="Commercial requirements" items={draft.commercialRequirements} onChange={(items) => updateDraft({ commercialRequirements: items })} />
            <EditableSummary title="Questionnaire" items={draft.questionnaire} onChange={(items) => updateDraft({ questionnaire: items })} />
            <EditableSummary title="Delivery requirements" items={draft.deliveryRequirements} onChange={(items) => updateDraft({ deliveryRequirements: items })} />
            <EditableSummary title="Quote terms" items={draft.quoteTerms} onChange={(items) => updateDraft({ quoteTerms: items })} />
          </div>

          <section className="mt-5 rounded-md border border-line bg-white p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="font-semibold">RFx validation</h3>
                <p className="text-sm text-muted">Checks are calculated from the structured RFx draft before supplier submission.</p>
              </div>
              <StatusBadge status={hasBlockedValidation ? "Blocked" : validation.some((item) => item.state === "REVIEW") ? "Review" : "Pass"} tone={hasBlockedValidation ? "danger" : validation.some((item) => item.state === "REVIEW") ? "warning" : "success"} />
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {validation.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 rounded-md border border-line bg-panel p-3 text-sm">
                  <span>{item.label}</span>
                  <StatusBadge status={item.state} tone={item.state === "PASS" ? "success" : item.state === "BLOCKED" ? "danger" : "warning"} />
                </div>
              ))}
            </div>
          </section>

          <div className="mt-5 flex flex-col gap-3 rounded-md border border-line bg-panel p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="font-semibold">Buyer review</h3>
              <p className="text-sm text-muted">Save the reviewed draft first. Submission to suppliers is a separate buyer action.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveReviewedDraft}
                disabled={savePending || draft.status !== "DRAFT_READY" || draft.lineItems.length === 0 || hasBlockedValidation}
                className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {savePending ? "Saving..." : "Save RFx draft"}
              </button>
              {draftSaved && (
                <button
                  type="button"
                  onClick={submitRfx}
                  disabled={submitPending || hasBlockedValidation}
                  className="rounded-md border border-accent px-4 py-2 text-sm font-semibold text-accent hover:bg-accent hover:text-white disabled:opacity-50"
                >
                  {submitPending ? "Submitting..." : "Submit RFx to suppliers"}
                </button>
              )}
            </div>
          </div>

          {submission && (
            <section className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-emerald-950">RFx submitted</h3>
                  <p className="mt-1 text-sm text-emerald-900">Email delivery is simulated for this prototype.</p>
                </div>
                <StatusBadge status="Sent" tone="success" />
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <Fact label="RFx ID" value={submission.rfxId} />
                <Fact label="Supplier count" value={String(submission.supplierCount)} />
                <Fact label="Line count" value={String(submission.lineCount)} />
                <Fact label="Channel" value={submission.channel ?? "Email"} />
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-5">
                {submission.suppliers.map((supplier) => (
                  <div key={supplier.vendorId} className="rounded-md border border-emerald-200 bg-white p-3">
                    <div className="text-sm font-semibold">{supplier.vendorName}</div>
                    <div className="mt-1 text-xs text-emerald-800">{supplier.status}</div>
                  </div>
                ))}
              </div>
              <Link href="/responses" className="mt-4 inline-flex rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
                View supplier responses
              </Link>
            </section>
          )}
        </section>
      )}
    </div>
  );
}

type ValidationState = "PASS" | "REVIEW" | "BLOCKED";

function validateDraft(draft: RfxDraft): Array<{ label: string; state: ValidationState }> {
  const hasLines = draft.lineItems.length > 0;
  return [
    { label: "Line items present", state: hasLines ? "PASS" : "BLOCKED" },
    { label: "Quantities present", state: hasLines && draft.lineItems.every((line) => line.quantity !== null) ? "PASS" : "BLOCKED" },
    { label: "Specifications present", state: hasLines && draft.lineItems.every((line) => Boolean(line.specification)) ? "PASS" : "BLOCKED" },
    { label: "Questionnaire configured", state: draft.questionnaire.length > 0 ? "PASS" : "REVIEW" },
    { label: "Commercial requirements configured", state: draft.commercialRequirements.length > 0 ? "PASS" : "REVIEW" },
    { label: "Delivery requirements configured", state: draft.deliveryRequirements.length > 0 ? "PASS" : "REVIEW" },
    { label: "Quote terms configured", state: draft.quoteTerms.length > 0 ? "PASS" : "REVIEW" },
    { label: "Assumptions requiring buyer confirmation", state: draft.assumptions.length > 0 ? "REVIEW" : "PASS" }
  ];
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-emerald-200 bg-white p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800">{label}</div>
      <div className="mt-1 text-sm font-semibold text-emerald-950">{value}</div>
    </div>
  );
}

function EditableSummary({ title, items, onChange }: { title: string; items: string[]; onChange: (items: string[]) => void }) {
  return (
    <div className="rounded-md border border-line bg-panel p-4">
      <label className="font-semibold" htmlFor={`summary-${title.replace(/\s+/g, "-").toLowerCase()}`}>{title}</label>
      <textarea
        id={`summary-${title.replace(/\s+/g, "-").toLowerCase()}`}
        value={items.join("\n")}
        onChange={(event) => onChange(event.target.value.split("\n").map((item) => item.trim()).filter(Boolean))}
        className="mt-2 min-h-[120px] w-full rounded-md border border-line bg-white p-3 text-sm outline-none focus:border-accent"
        placeholder="Add one item per line."
      />
    </div>
  );
}
