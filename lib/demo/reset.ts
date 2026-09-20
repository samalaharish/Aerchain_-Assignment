import { rm } from "fs/promises";
import path from "path";
import { clearDemoComparisonDatasetCache } from "@/lib/extraction/comparison-source";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const demoMutableStateKeys = [
  "reviewed-rfx-draft",
  "rfx-workflow-state",
  "decision-state"
] as const;

export type DemoStateFilePaths = Record<(typeof demoMutableStateKeys)[number], string>;

export function defaultDemoStateFilePaths(): DemoStateFilePaths {
  const cacheDir = path.join(process.cwd(), ".cache");
  return {
    "reviewed-rfx-draft": path.join(cacheDir, "reviewed-rfx-draft.json"),
    "rfx-workflow-state": path.join(cacheDir, "rfx-workflow-state.json"),
    "decision-state": path.join(cacheDir, "decision-state.json")
  };
}

export async function resetDemoWorkflowState(options: { filePaths?: DemoStateFilePaths } = {}) {
  const client = getSupabaseServerClient();
  if (client) {
    await Promise.all(demoMutableStateKeys.map((key) => client.deleteState(key)));
  } else {
    await resetLocalDemoWorkflowState(options.filePaths ?? defaultDemoStateFilePaths());
  }

  clearDemoComparisonDatasetCache();
}

export async function resetLocalDemoWorkflowState(filePaths: DemoStateFilePaths) {
  await Promise.all(
    demoMutableStateKeys.map((key) => rm(filePaths[key], { force: true }))
  );
}
