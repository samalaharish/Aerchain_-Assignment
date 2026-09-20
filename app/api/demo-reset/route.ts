import { NextResponse } from "next/server";
import { resetDemoWorkflowState } from "@/lib/demo/reset";

export const dynamic = "force-dynamic";

export async function POST() {
  await resetDemoWorkflowState();
  return NextResponse.json({ ok: true, redirectTo: "/" });
}
