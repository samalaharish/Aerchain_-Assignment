import { NextResponse } from "next/server";
import { z } from "zod";
import { clearDemoComparisonDatasetCache } from "@/lib/extraction/comparison-source";
import { rfxDraftSchema } from "@/lib/rfx/copilot";
import { readReviewedRfxDraft, writeReviewedRfxDraft } from "@/lib/rfx/draft-store";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  draft: rfxDraftSchema
});

export async function GET() {
  const draft = await readReviewedRfxDraft();
  return NextResponse.json({ draft });
}

export async function PUT(request: Request) {
  const body = requestSchema.parse(await request.json());
  const draft = await writeReviewedRfxDraft(body.draft);
  clearDemoComparisonDatasetCache();
  return NextResponse.json({ draft });
}
