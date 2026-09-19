import { buildComparisonDataset, type ComparisonDataset } from "@/lib/domain/comparison";
import { runFixtureExtractionWorkflow } from "@/lib/extraction/workflow";
import { getActiveProcurementEvent } from "@/lib/rfx/active-event";

export async function buildDemoComparisonDataset(): Promise<ComparisonDataset> {
  if (cachedDataset) return cachedDataset;

  const event = await getActiveProcurementEvent();
  const results = await Promise.all(event.documents.map((document) => runFixtureExtractionWorkflow(document.id)));
  const extractions = results.flatMap((result) => result.extraction ? [result.extraction] : []);

  cachedDataset = buildComparisonDataset({
    event,
    extractions
  });
  return cachedDataset;
}

let cachedDataset: ComparisonDataset | null = null;

export function clearDemoComparisonDatasetCache() {
  cachedDataset = null;
}
