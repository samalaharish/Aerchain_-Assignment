import { NextResponse } from "next/server";
import { readReviewedRfxDraft } from "@/lib/rfx/draft-store";
import { submitRfxToSuppliers } from "@/lib/rfx/workflow-state";

export const dynamic = "force-dynamic";

export async function POST() {
  const draft = await readReviewedRfxDraft();
  if (!draft || draft.status !== "DRAFT_READY" || draft.lineItems.length === 0) {
    return NextResponse.json({ error: "A reviewed RFx draft must be saved before submission." }, { status: 400 });
  }

  const state = await submitRfxToSuppliers();
  return NextResponse.json({ state });
}
