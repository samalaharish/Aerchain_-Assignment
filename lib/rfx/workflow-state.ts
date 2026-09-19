import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { z } from "zod";
import { procurementEvent } from "@/lib/fixtures/procurement-event";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const rfxWorkflowStatusSchema = z.enum([
  "DRAFT",
  "READY_TO_SEND",
  "SENT",
  "RESPONSES_RECEIVED",
  "ANALYSIS_READY",
  "DECISION_READY"
]);

export const supplierSubmissionSchema = z.object({
  vendorId: z.string(),
  vendorName: z.string(),
  status: z.enum(["Sent"])
});

export const rfxWorkflowStateSchema = z.object({
  rfxId: z.string(),
  status: rfxWorkflowStatusSchema,
  supplierCount: z.number().int().nonnegative(),
  lineCount: z.number().int().nonnegative(),
  channel: z.literal("Email").nullable(),
  submittedAt: z.string().nullable(),
  suppliers: z.array(supplierSubmissionSchema),
  updatedAt: z.string()
});

export type RfxWorkflowStatus = z.infer<typeof rfxWorkflowStatusSchema>;
export type RfxWorkflowState = z.infer<typeof rfxWorkflowStateSchema>;

const stateKey = "rfx-workflow-state";
const fallbackPath = path.join(process.cwd(), ".cache", "rfx-workflow-state.json");

export async function readRfxWorkflowState(): Promise<RfxWorkflowState> {
  const client = getSupabaseServerClient();
  if (client) {
    const state = await client.getState<RfxWorkflowState>(stateKey);
    return state ? rfxWorkflowStateSchema.parse(state) : defaultRfxWorkflowState("DRAFT");
  }

  try {
    const raw = await readFile(fallbackPath, "utf8");
    return rfxWorkflowStateSchema.parse(JSON.parse(raw));
  } catch {
    return defaultRfxWorkflowState("DRAFT");
  }
}

export async function writeRfxWorkflowState(state: RfxWorkflowState): Promise<RfxWorkflowState> {
  const parsed = rfxWorkflowStateSchema.parse(state);
  const client = getSupabaseServerClient();
  if (client) {
    await client.upsertState(stateKey, parsed);
    return parsed;
  }

  await mkdir(path.dirname(fallbackPath), { recursive: true });
  await writeFile(fallbackPath, JSON.stringify(parsed, null, 2), "utf8");
  return parsed;
}

export async function updateRfxWorkflowStatus(status: RfxWorkflowStatus): Promise<RfxWorkflowState> {
  const current = await readRfxWorkflowState();
  return await writeRfxWorkflowState({
    ...current,
    status,
    updatedAt: new Date().toISOString()
  });
}

export async function submitRfxToSuppliers(): Promise<RfxWorkflowState> {
  return await writeRfxWorkflowState(defaultRfxWorkflowState("SENT", new Date().toISOString()));
}

export function workflowStatusLabel(status: RfxWorkflowStatus): string {
  if (status === "DRAFT") return "RFx draft · Buyer review required";
  if (status === "READY_TO_SEND") return "RFx draft · Ready to submit";
  if (status === "SENT") return "RFx active · Awaiting supplier responses";
  if (status === "RESPONSES_RECEIVED") return "Responses received";
  if (status === "ANALYSIS_READY") return "Analysis ready";
  return "Decision ready";
}

function defaultRfxWorkflowState(status: RfxWorkflowStatus, submittedAt: string | null = null): RfxWorkflowState {
  return {
    rfxId: procurementEvent.rfx.id,
    status,
    supplierCount: procurementEvent.vendors.length,
    lineCount: procurementEvent.lineItems.length,
    channel: submittedAt ? "Email" : null,
    submittedAt,
    suppliers: submittedAt
      ? procurementEvent.vendors.map((vendor) => ({ vendorId: vendor.id, vendorName: vendor.name, status: "Sent" }))
      : [],
    updatedAt: new Date().toISOString()
  };
}
