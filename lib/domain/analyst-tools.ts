import type { ComparisonDataset, NormalizedVendorQuote } from "@/lib/domain/comparison";
import { formatComparisonMoney } from "@/lib/domain/comparison";
import { calculateScenarios, type ScenarioResult } from "@/lib/domain/scenarios";
import { procurementEvent } from "@/lib/fixtures/procurement-event";

export type AnalystAnswer = {
  title: string;
  answer: string;
  metrics: { label: string; value: string }[];
  evidence: { label: string; detail: string; href: string }[];
  actions: { label: string; href: string }[];
  caveat: string | null;
};

export function getSupplierCoverage(dataset: ComparisonDataset) {
  return procurementEvent.vendors.map((vendor) => {
    const cells = dataset.lines.flatMap((line) => line.vendors.filter((cell) => cell.vendorId === vendor.id));
    return {
      vendorId: vendor.id,
      vendorName: vendor.name,
      quoted: cells.filter((cell) => cell.quoteStatus !== "NOT_QUOTED").length,
      notQuoted: cells.filter((cell) => cell.quoteStatus === "NOT_QUOTED").length,
      ready: cells.filter((cell) => cell.reviewState === "READY").length,
      review: cells.filter((cell) => cell.reviewState !== "READY").length
    };
  });
}

export function getLargestExceptions(dataset: ComparisonDataset) {
  return dataset.lines.flatMap((line) =>
    line.vendors.flatMap((cell) =>
      cell.exceptions.map((exception) => ({
        lineNumber: line.lineNumber,
        lineDescription: line.description,
        vendorName: cell.vendorName,
        code: exception.code,
        message: exception.message,
        severity: exception.severity
      }))
    )
  ).sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}

export function getPriceSpreadLines(dataset: ComparisonDataset) {
  return dataset.lines.map((line) => {
    const ready = line.vendors.filter((cell) => cell.reviewState === "READY" && cell.normalized.landedUnitCost !== null);
    const prices = ready.map((cell) => cell.normalized.landedUnitCost as number);
    return {
      lineNumber: line.lineNumber,
      description: line.description,
      spread: prices.length >= 2 ? Math.max(...prices) - Math.min(...prices) : null,
      supplierCount: ready.length
    };
  }).filter((item) => item.spread !== null).sort((a, b) => (b.spread ?? 0) - (a.spread ?? 0));
}

export function answerAnalystQuestion(dataset: ComparisonDataset, question: string): AnalystAnswer {
  const normalized = question.toLowerCase();
  if (normalized.includes("split") || normalized.includes("quality questionnaire") || normalized.includes("quality-approved")) return answerQualitySplitAward(dataset);
  if (normalized.includes("incomplete") || normalized.includes("coverage")) return answerCoverage(dataset);
  if (normalized.includes("exception") || normalized.includes("review")) return answerExceptions(dataset);
  if (normalized.includes("difference") || normalized.includes("spread")) return answerPriceSpread(dataset);
  return answerLowestComparableCost(dataset);
}

function answerQualitySplitAward(dataset: ComparisonDataset): AnalystAnswer {
  const scenario = calculateScenarios(dataset).find((item) => item.goal === "QUALITY_APPROVED_ONLY") as ScenarioResult;
  return {
    title: "Quality-approved split award",
    answer: scenario.estimatedCost === null
      ? "There is not enough comparable data to calculate a quality-approved split award."
      : `Using only quality-approved suppliers, deterministic tools allocate ${scenario.coverageLines}/${scenario.totalLines} lines with an estimated normalized cost of ${formatComparisonMoney(scenario.estimatedCost, scenario.currency)}.`,
    metrics: [
      { label: "Coverage", value: `${scenario.coverageLines}/${scenario.totalLines} lines` },
      { label: "Suppliers used", value: String(scenario.supplierCount) },
      { label: "Unresolved issues", value: String(scenario.issues.length) }
    ],
    evidence: [
      { label: "Scenario allocation", detail: `${scenario.allocations.length} line allocations calculated by deterministic code.`, href: "/scenarios" },
      { label: "Quality eligibility", detail: "Quality-approved scenario excludes failed-quality suppliers.", href: "/responses" },
      { label: "Exceptions", detail: `${dataset.metrics.supplierQuotesNeedReview} supplier quote cells need review.`, href: "/exceptions" }
    ],
    actions: [
      { label: "View scenarios", href: "/scenarios" },
      { label: "View comparison", href: "/comparison?filter=ready" }
    ],
    caveat: scenario.status === "INSUFFICIENT_DATA" ? "Some lines are excluded because they are not comparison-ready under quality constraints." : null
  };
}

export function answerLowestComparableCost(dataset: ComparisonDataset): AnalystAnswer {
  const scenario = calculateScenarios(dataset).find((item) => item.goal === "LOWEST_COMPARABLE_COST") as ScenarioResult;
  return {
    title: "Lowest comparable cost",
    answer: scenario.estimatedCost === null
      ? "There is not enough comparison-ready data to calculate a lowest comparable cost."
      : `The deterministic lowest-comparable-cost scenario totals ${formatComparisonMoney(scenario.estimatedCost, scenario.currency)} across ${scenario.coverageLines}/${scenario.totalLines} RFx lines.`,
    metrics: [
      { label: "Coverage", value: `${scenario.coverageLines}/${scenario.totalLines} lines` },
      { label: "Suppliers used", value: String(scenario.supplierCount) },
      { label: "Review items", value: String(dataset.metrics.reviewRequiredCells + dataset.metrics.blockedCells) }
    ],
    evidence: [
      { label: "Comparison dataset", detail: `${dataset.metrics.readyCells} ready cells`, href: "/comparison" },
      { label: "Exceptions", detail: `${dataset.metrics.blockedCells} blocked cells`, href: "/exceptions" }
    ],
    actions: [
      { label: "View comparison", href: "/comparison" },
      { label: "Run scenarios", href: "/scenarios" }
    ],
    caveat: scenario.status === "INSUFFICIENT_DATA" ? "Some lines are excluded because they are not comparison-ready." : null
  };
}

function answerCoverage(dataset: ComparisonDataset): AnalystAnswer {
  const coverage = getSupplierCoverage(dataset);
  const weakest = [...coverage].sort((a, b) => b.notQuoted - a.notQuoted)[0];
  return {
    title: "Supplier coverage",
    answer: `${weakest.vendorName} has the most incomplete coverage with ${weakest.notQuoted} not-quoted lines. Coverage should be reviewed before final analysis.`,
    metrics: coverage.map((item) => ({ label: item.vendorName, value: `${item.quoted}/30 quoted` })),
    evidence: [{ label: "Supplier response queue", detail: "Coverage is calculated from validated extraction results.", href: "/responses" }],
    actions: [{ label: "Review responses", href: "/responses" }, { label: "View exceptions", href: "/exceptions" }],
    caveat: null
  };
}

function answerExceptions(dataset: ComparisonDataset): AnalystAnswer {
  const exceptions = getLargestExceptions(dataset);
  const top = exceptions.slice(0, 3);
  return {
    title: "Review priorities",
    answer: `${exceptions.length} exception records are affecting comparison readiness. Start with high-severity missing quote, price, currency, unit conversion, and quality issues.`,
    metrics: [
      { label: "High severity", value: String(exceptions.filter((item) => item.severity === "HIGH").length) },
      { label: "Blocked cells", value: String(dataset.metrics.blockedCells) },
      { label: "Review cells", value: String(dataset.metrics.reviewRequiredCells) }
    ],
    evidence: top.map((item) => ({ label: `${item.vendorName} · Line ${item.lineNumber}`, detail: `${item.code}: ${item.message}`, href: "/exceptions" })),
    actions: [{ label: "Open review queue", href: "/exceptions" }, { label: "View comparison", href: "/comparison?filter=blocked" }],
    caveat: null
  };
}

function answerPriceSpread(dataset: ComparisonDataset): AnalystAnswer {
  const spreads = getPriceSpreadLines(dataset).slice(0, 5);
  return {
    title: "Largest price differences",
    answer: spreads.length === 0
      ? "There are not enough ready comparable supplier prices to calculate price spreads."
      : `The largest ready-line price spread is on line ${spreads[0].lineNumber}: ${spreads[0].description}.`,
    metrics: spreads.map((item) => ({ label: `Line ${item.lineNumber}`, value: formatComparisonMoney(item.spread ?? 0, dataset.baseCurrency) })),
    evidence: [{ label: "Ready supplier cells", detail: "Only READY comparison cells are included.", href: "/comparison?filter=ready" }],
    actions: [{ label: "View comparison", href: "/comparison?filter=ready" }],
    caveat: "Lines with unresolved exceptions are excluded from spread calculations."
  };
}

function severityRank(severity: "LOW" | "MEDIUM" | "HIGH") {
  return severity === "HIGH" ? 3 : severity === "MEDIUM" ? 2 : 1;
}
