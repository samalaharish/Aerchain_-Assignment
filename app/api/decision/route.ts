import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createDecisionRecord, transitionDecisionStatus, type DecisionRecord, type DecisionStatus } from "@/lib/domain/decision";
import { calculateScenarios } from "@/lib/domain/scenarios";
import { buildDemoComparisonDataset } from "@/lib/extraction/comparison-source";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  status: z.enum(["DRAFT", "READY_FOR_REVIEW", "APPROVED", "RETURNED"])
});

const decisionPath = path.join(process.cwd(), ".cache", "decision-state.json");
const decisionStateKey = "decision-state";

export async function GET() {
  const record = await readDecisionRecord();
  return NextResponse.json(record);
}

export async function POST(request: Request) {
  const body = requestSchema.parse(await request.json());
  const current = await readDecisionRecord();
  const nextStatus = transitionDecisionStatus(current.status, body.status);
  const updated = {
    ...current,
    status: nextStatus,
    updatedAt: new Date().toISOString()
  };
  await writeDecisionRecord(updated);
  return NextResponse.json(updated);
}

async function readDecisionRecord(): Promise<DecisionRecord> {
  const fresh = await freshDecisionRecord();
  const client = getSupabaseServerClient();
  if (client) {
    try {
      const stored = await client.getState<DecisionRecord>(decisionStateKey);
      if (stored) return await reconcileDecisionRecord(fresh, stored);
      await writeDecisionRecord(fresh);
      return fresh;
    } catch (error) {
      console.warn("Supabase decision state read failed; using local fallback.", error);
    }
  }

  try {
    const raw = await readFile(decisionPath, "utf8");
    const stored = JSON.parse(raw) as DecisionRecord;
    return await reconcileDecisionRecord(fresh, stored);
  } catch {
    await writeDecisionRecord(fresh);
    return fresh;
  }
}

async function freshDecisionRecord(): Promise<DecisionRecord> {
  const dataset = await buildDemoComparisonDataset();
  const scenarios = calculateScenarios(dataset);
  const selected = scenarios.find((scenario) => scenario.goal === "QUALITY_APPROVED_ONLY") ?? scenarios[0];
  return createDecisionRecord({ dataset, scenario: selected, status: defaultStatus(dataset.metrics.supplierQuotesNeedReview) });
}

async function writeDecisionRecord(record: DecisionRecord) {
  const client = getSupabaseServerClient();
  if (client) {
    try {
      await client.upsertState(decisionStateKey, record);
      return;
    } catch (error) {
      console.warn("Supabase decision state write failed; using local fallback.", error);
    }
  }

  await mkdir(path.dirname(decisionPath), { recursive: true });
  await writeFile(decisionPath, JSON.stringify(record, null, 2), "utf8");
}

async function reconcileDecisionRecord(fresh: DecisionRecord, stored: DecisionRecord): Promise<DecisionRecord> {
  const refreshed = {
    ...fresh,
    status: stored.status,
    updatedAt: stored.updatedAt
  };
  if (
    refreshed.comparisonDatasetVersion !== stored.comparisonDatasetVersion
    || refreshed.unresolvedExceptions !== stored.unresolvedExceptions
    || refreshed.scenarioId !== stored.scenarioId
  ) {
    const updated = { ...refreshed, updatedAt: new Date().toISOString() };
    await writeDecisionRecord(updated);
    return updated;
  }
  return refreshed;
}

function defaultStatus(unresolved: number): DecisionStatus {
  return unresolved > 0 ? "DRAFT" : "READY_FOR_REVIEW";
}
