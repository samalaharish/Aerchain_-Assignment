import { procurementEvent } from "@/lib/fixtures/procurement-event";
import type { ProcurementEvent, RfxLineItem, Unit } from "@/lib/domain/types";
import type { RfxDraft } from "@/lib/rfx/copilot";
import { readReviewedRfxDraft } from "@/lib/rfx/draft-store";

export async function getActiveProcurementEvent(): Promise<ProcurementEvent> {
  const draft = await readReviewedRfxDraft();
  return draft ? applyRfxDraftToEvent(procurementEvent, draft) : procurementEvent;
}

export function applyRfxDraftToEvent(event: ProcurementEvent, draft: RfxDraft): ProcurementEvent {
  if (draft.status !== "DRAFT_READY" || draft.lineItems.length === 0) return event;

  const draftByLineNumber = new Map(draft.lineItems.map((line) => [line.lineNumber, line]));
  const updatedLineItems: RfxLineItem[] = event.lineItems.map((line) => {
    const draftLine = draftByLineNumber.get(line.lineNumber);
    if (!draftLine) return line;

    return {
      ...line,
      description: draftLine.description,
      specification: draftLine.specification ?? line.specification,
      quantity: draftLine.quantity ?? line.quantity,
      unit: parseDraftUnit(draftLine.unit) ?? line.unit
    };
  });

  return {
    ...event,
    rfx: {
      ...event.rfx,
      description: draft.scope ?? event.rfx.description
    },
    lineItems: updatedLineItems
  };
}

function parseDraftUnit(unit: string | null): Unit | null {
  const value = unit?.trim().toLowerCase().replace(/[-\s]+/g, "_");
  if (!value) return null;
  if (["piece", "pieces", "pc", "pcs", "each", "ea"].includes(value)) return "piece";
  if (["hundred_pieces", "100_pieces", "per_100_pieces", "per_100_pcs"].includes(value)) return "hundred_pieces";
  if (["box", "per_box"].includes(value)) return "box";
  if (["carton", "per_carton"].includes(value)) return "carton";
  if (["bundle", "per_bundle"].includes(value)) return "bundle";
  if (value === "kg") return "kg";
  if (value === "sqm") return "sqm";
  return "unknown";
}
