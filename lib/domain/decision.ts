import type { ComparisonDataset } from "@/lib/domain/comparison";
import type { ScenarioResult } from "@/lib/domain/scenarios";

export type DecisionStatus = "DRAFT" | "READY_FOR_REVIEW" | "APPROVED" | "RETURNED";

export type DecisionRecord = {
  id: string;
  rfxId: string;
  rfxVersion: string;
  scenarioId: string;
  scenarioName: string;
  comparisonDatasetVersion: string;
  unresolvedExceptions: number;
  assumptions: string[];
  evidenceLinks: { label: string; href: string }[];
  status: DecisionStatus;
  updatedAt: string;
};

export function createDecisionRecord(input: {
  dataset: ComparisonDataset;
  scenario: ScenarioResult;
  status?: DecisionStatus;
  now?: string;
}): DecisionRecord {
  const now = input.now ?? new Date().toISOString();
  return {
    id: `${input.dataset.rfxId}-decision`,
    rfxId: input.dataset.rfxId,
    rfxVersion: input.dataset.rfxId,
    scenarioId: input.scenario.id,
    scenarioName: input.scenario.name,
    comparisonDatasetVersion: input.dataset.generatedAt,
    unresolvedExceptions: input.dataset.metrics.supplierQuotesNeedReview,
    assumptions: [
      "Prototype FX rates are used.",
      "Only comparable quote cells are used for scenario calculations.",
      "Missing supplier quotes are excluded and never treated as zero.",
      "Freight is included only where deterministic evidence supports it."
    ],
    evidenceLinks: [
      { label: "View comparison", href: "/comparison" },
      { label: "View exceptions", href: "/exceptions" },
      { label: "View supplier responses", href: "/responses" }
    ],
    status: input.status ?? "DRAFT",
    updatedAt: now
  };
}

export function transitionDecisionStatus(current: DecisionStatus, next: DecisionStatus): DecisionStatus {
  const allowed: Record<DecisionStatus, DecisionStatus[]> = {
    DRAFT: ["READY_FOR_REVIEW", "RETURNED"],
    READY_FOR_REVIEW: ["APPROVED", "RETURNED", "DRAFT"],
    APPROVED: ["RETURNED"],
    RETURNED: ["READY_FOR_REVIEW", "DRAFT"]
  };

  if (!allowed[current].includes(next)) {
    throw new Error(`Invalid decision transition from ${current} to ${next}`);
  }

  return next;
}
