import type { ComparisonDataset, NormalizedVendorQuote } from "@/lib/domain/comparison";
import { formatComparisonMoney } from "@/lib/domain/comparison";
import type { Currency } from "@/lib/domain/types";
import { procurementEvent } from "@/lib/fixtures/procurement-event";

export type ProcurementGoalId =
  | "LOWEST_COMPARABLE_COST"
  | "QUALITY_APPROVED_ONLY"
  | "MAXIMIZE_COVERAGE"
  | "MINIMIZE_FRAGMENTATION"
  | "SPLIT_AWARD";

export type StructuredGoal = {
  id: ProcurementGoalId;
  label: string;
  constraints: {
    requireQualityPass: boolean;
    excludeCriticalExceptions: boolean;
    preferSingleSupplier: boolean;
    includeFreight: boolean;
  };
};

export type ScenarioResult = {
  id: string;
  name: string;
  goal: ProcurementGoalId;
  status: "CALCULATED" | "INSUFFICIENT_DATA";
  estimatedCost: number | null;
  currency: Currency;
  coverageLines: number;
  totalLines: number;
  supplierCount: number;
  allocations: ScenarioAllocation[];
  issues: string[];
  summary: string;
};

export type ScenarioAllocation = {
  rfxLineId: string;
  lineNumber: number;
  description: string;
  vendorId: string;
  vendorName: string;
  landedTotal: number;
};

export const defaultGoals: StructuredGoal[] = [
  {
    id: "LOWEST_COMPARABLE_COST",
    label: "Lowest comparable cost",
    constraints: {
      requireQualityPass: false,
      excludeCriticalExceptions: true,
      preferSingleSupplier: false,
      includeFreight: true
    }
  },
  {
    id: "QUALITY_APPROVED_ONLY",
    label: "Lowest cost among quality-approved suppliers",
    constraints: {
      requireQualityPass: true,
      excludeCriticalExceptions: true,
      preferSingleSupplier: false,
      includeFreight: true
    }
  },
  {
    id: "SPLIT_AWARD",
    label: "Split award",
    constraints: {
      requireQualityPass: false,
      excludeCriticalExceptions: true,
      preferSingleSupplier: false,
      includeFreight: true
    }
  }
];

export function calculateScenarios(dataset: ComparisonDataset): ScenarioResult[] {
  return defaultGoals.map((goal) => calculateScenario(dataset, goal));
}

export function calculateScenario(dataset: ComparisonDataset, goal: StructuredGoal): ScenarioResult {
  const allocations: ScenarioAllocation[] = [];
  const issues: string[] = [];

  for (const line of dataset.lines) {
    const candidates = line.vendors
      .filter((cell) => isEligible(cell, goal))
      .filter((cell) => cell.normalized.landedTotal !== null)
      .sort((a, b) => (a.normalized.landedTotal ?? Number.POSITIVE_INFINITY) - (b.normalized.landedTotal ?? Number.POSITIVE_INFINITY));

    const selected = candidates[0];
    if (!selected || selected.normalized.landedTotal === null) {
      issues.push(`Line ${line.lineNumber} has no eligible comparable supplier.`);
      continue;
    }

    allocations.push({
      rfxLineId: line.rfxLineId,
      lineNumber: line.lineNumber,
      description: line.description,
      vendorId: selected.vendorId,
      vendorName: selected.vendorName,
      landedTotal: selected.normalized.landedTotal
    });
  }

  const estimatedCost = allocations.length > 0
    ? Math.round(allocations.reduce((total, item) => total + item.landedTotal, 0) * 100) / 100
    : null;
  const supplierCount = new Set(allocations.map((item) => item.vendorId)).size;
  const status = allocations.length === dataset.metrics.totalRfxLines ? "CALCULATED" : "INSUFFICIENT_DATA";

  return {
    id: goal.id.toLowerCase(),
    name: goal.label,
    goal: goal.id,
    status,
    estimatedCost,
    currency: dataset.baseCurrency,
    coverageLines: allocations.length,
    totalLines: dataset.metrics.totalRfxLines,
    supplierCount,
    allocations,
    issues,
    summary: estimatedCost === null
      ? "Insufficient data to calculate this scenario."
      : `${goal.label}: ${formatComparisonMoney(estimatedCost, dataset.baseCurrency)} across ${allocations.length}/${dataset.metrics.totalRfxLines} lines.`
  };
}

function isEligible(cell: NormalizedVendorQuote, goal: StructuredGoal): boolean {
  if (cell.reviewState !== "READY") return false;
  if (goal.constraints.requireQualityPass) {
    const vendor = procurementEvent.vendors.find((item) => item.id === cell.vendorId);
    if (vendor?.qualityStatus !== "PASS") return false;
  }
  if (goal.constraints.excludeCriticalExceptions && cell.exceptions.some((item) => item.severity === "HIGH")) return false;
  return true;
}
