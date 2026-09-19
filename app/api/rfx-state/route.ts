import { NextResponse } from "next/server";
import { readRfxWorkflowState } from "@/lib/rfx/workflow-state";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = await readRfxWorkflowState();
  return NextResponse.json({ state });
}
