"use client";

import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import type { RfxDraft } from "@/lib/rfx/copilot";

const defaultPrompt = "I need corrugated packaging for our West India fulfillment network. We need around 30 carton SKUs. Ask suppliers for pricing, MOQ, lead time, freight and quality information.";
type DraftLine = RfxDraft["lineItems"][number];

export function RfxCopilot() {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [draft, setDraft] = useState<RfxDraft | null>(null);
  const [pending, setPending] = useState(false);
  const [savePending, setSavePending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/rfx-draft")
      .then((response) => response.ok ? response.json() : null)
      .then((payload: { draft?: RfxDraft | null } | null) => {
        if (active && payload?.draft) setDraft(payload.draft);
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
      setSaveMessage("Reviewed RFx draft saved. Downstream RFx review and comparison will use this version.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the reviewed RFx draft.");
    } finally {
      setSavePending(false);
    }
  }

  function updateDraft(patch: Partial<RfxDraft>) {
    setDraft((current) => current ? { ...current, ...patch } : current);
    setSaveMessage(null);
  }

  function updateLine(lineNumber: number, patch: Partial<DraftLine>) {
    setDraft((current) => current ? {
      ...current,
      lineItems: current.lineItems.map((line) => line.lineNumber === lineNumber ? { ...line, ...patch } : line)
    } : current);
    setSaveMessage(null);
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
  }

  function removeLine(lineNumber: number) {
    setDraft((current) => current ? {
      ...current,
      lineItems: current.lineItems.filter((line) => line.lineNumber !== lineNumber)
    } : current);
    setSaveMessage(null);
  }

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
            <StatusBadge status={draft.status === "DRAFT_READY" ? "Draft ready" : "Needs clarification"} tone={draft.status === "DRAFT_READY" ? "success" : "warning"} />
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

          <div className="mt-5 flex flex-col gap-3 rounded-md border border-line bg-panel p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="font-semibold">Buyer review</h3>
              <p className="text-sm text-muted">Save only after confirming assumptions, quantities, terms, and questionnaire requirements.</p>
            </div>
            <button
              type="button"
              onClick={saveReviewedDraft}
              disabled={savePending || draft.status !== "DRAFT_READY" || draft.lineItems.length === 0}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
            >
              {savePending ? "Saving..." : "Save reviewed draft"}
            </button>
          </div>
        </section>
      )}
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
