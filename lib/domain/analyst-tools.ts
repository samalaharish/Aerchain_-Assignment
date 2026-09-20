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

export type AnalystToolName =
  | "supplierCoverage"
  | "lowestComparableCost"
  | "priceSpread"
  | "exceptions"
  | "qualityAndCoverage"
  | "splitAwardScenario"
  | "scenarioAnalysis"
  | "ratingAvailability";

export type AnalystPlan = {
  goal: string;
  dataNeeded: string[];
  tools: { name: AnalystToolName; arguments?: Record<string, unknown> }[];
  constraints: string[];
  unsupportedReason?: string | null;
};

export type AnalystToolResult = {
  toolName: AnalystToolName;
  title: string;
  summary: string;
  metrics: AnalystAnswer["metrics"];
  evidence: AnalystAnswer["evidence"];
  actions: AnalystAnswer["actions"];
  caveat: string | null;
  data: unknown;
};

type AnalystToolDefinition = {
  name: AnalystToolName;
  description: string;
  dataProvided: string[];
  fallbackTerms: string[];
  execute: (dataset: ComparisonDataset, args?: Record<string, unknown>) => AnalystToolResult;
};

export const analystToolRegistry: AnalystToolDefinition[] = [
  {
    name: "supplierCoverage",
    description: "Supplier quote coverage, quoted lines, not-quoted lines, and ready/review counts.",
    dataProvided: ["supplier_quote_coverage", "total_rfx_lines", "not_quoted_lines"],
    fallbackTerms: ["coverage", "incomplete", "quoted", "quotes", "sku", "skus", "all 30", "missing"],
    execute: executeSupplierCoverage
  },
  {
    name: "lowestComparableCost",
    description: "Lowest comparable cost scenario using ready normalized supplier-line cells.",
    dataProvided: ["lowest_comparable_cost", "normalized_cost", "scenario_total"],
    fallbackTerms: ["lowest", "cheapest", "cost"],
    execute: executeLowestComparableCost
  },
  {
    name: "priceSpread",
    description: "RFx lines with the largest normalized price differences across ready supplier quotes.",
    dataProvided: ["price_spread", "line_level_price_differences"],
    fallbackTerms: ["spread", "difference", "differences", "largest price"],
    execute: executePriceSpread
  },
  {
    name: "exceptions",
    description: "Review issues, blocked cells, ambiguous values, missing quotes, and exception priorities.",
    dataProvided: ["exceptions", "review_items", "blocked_cells", "unresolved_issues"],
    fallbackTerms: ["exception", "review", "issue", "issues", "award", "awarding", "unresolved", "blocked"],
    execute: executeExceptions
  },
  {
    name: "qualityAndCoverage",
    description: "Supplier quality status combined with quote coverage/readiness.",
    dataProvided: ["quality_status", "questionnaire_status", "supplier_quote_coverage"],
    fallbackTerms: ["quality", "questionnaire", "strongest", "status"],
    execute: executeQualityAndCoverage
  },
  {
    name: "splitAwardScenario",
    description: "Line-level split-award scenario, including quality-approved constraints when requested.",
    dataProvided: ["split_award", "quality_approved_split_award", "scenario_allocation"],
    fallbackTerms: ["split", "allocate", "allocation", "quality-approved"],
    execute: executeSplitAwardScenario
  },
  {
    name: "scenarioAnalysis",
    description: "All available deterministic sourcing scenarios and their status.",
    dataProvided: ["scenario_analysis", "lowest_cost", "quality_approved", "split_award"],
    fallbackTerms: ["scenario", "what if"],
    execute: executeScenarioAnalysis
  },
  {
    name: "ratingAvailability",
    description: "Checks whether supplier rating exists in the RFx dataset.",
    dataProvided: ["supplier_rating_availability"],
    fallbackTerms: ["rating", "rated", "rank"],
    execute: executeRatingAvailability
  }
];

export function getSupplierCoverage(dataset: ComparisonDataset) {
  return procurementEvent.vendors.map((vendor) => {
    const cells = dataset.lines.flatMap((line) => line.vendors.filter((cell) => cell.vendorId === vendor.id));
    return {
      vendorId: vendor.id,
      vendorName: vendor.name,
      qualityStatus: vendor.qualityStatus,
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

export function planAnalystQuestionDeterministically(question: string, history: string[] = []): AnalystPlan {
  const text = `${history.slice(-4).join(" ")} ${question}`.toLowerCase();
  const scored = analystToolRegistry
    .map((tool) => ({ tool, score: tool.fallbackTerms.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, text.includes("strongest") || text.includes("award") || text.includes("overall") ? 4 : 2);

  if (scored.length === 0) {
    return {
      goal: "unsupported",
      dataNeeded: [],
      tools: [],
      constraints: ["Use only available RFx comparison data."],
      unsupportedReason: "No available procurement tool matched the buyer question."
    };
  }

  return {
    goal: "answer buyer question",
    dataNeeded: Array.from(new Set(scored.flatMap((item) => item.tool.dataProvided))),
    tools: scored.map((item) => ({ name: item.tool.name, arguments: {} })),
    constraints: ["Use only suppliers and extracted values in this RFx."]
  };
}

export function executeAnalystPlan(dataset: ComparisonDataset, plan: AnalystPlan): AnalystToolResult[] {
  if (plan.unsupportedReason || plan.tools.length === 0) return [unsupportedResult(plan.unsupportedReason ?? undefined)];
  const results = plan.tools.map((toolCall) => {
    const tool = analystToolRegistry.find((item) => item.name === toolCall.name);
    return tool ? tool.execute(dataset, toolCall.arguments) : unsupportedResult(`Tool ${toolCall.name} is not available.`);
  });
  return results.filter((item, index, all) => all.findIndex((other) => other.toolName === item.toolName) === index);
}

export function answerAnalystQuestion(dataset: ComparisonDataset, question: string): AnalystAnswer {
  return answerFromToolResults(executeAnalystPlan(dataset, planAnalystQuestionDeterministically(question)));
}

export function answerFromToolResults(results: AnalystToolResult[]): AnalystAnswer {
  const first = results[0] ?? unsupportedResult();
  if (results.length === 1) return toolResultToAnswer(first);

  return {
    title: "Procurement analysis",
    answer: `I reviewed ${results.map((result) => result.title.toLowerCase()).join(", ")} using deterministic procurement tools.`,
    metrics: results.flatMap((result) => result.metrics).slice(0, 6),
    evidence: dedupeByHref(results.flatMap((result) => result.evidence)).slice(0, 6),
    actions: dedupeActions(results.flatMap((result) => result.actions)).slice(0, 4),
    caveat: results.map((result) => result.caveat).find(Boolean) ?? null
  };
}

export function answerLowestComparableCost(dataset: ComparisonDataset): AnalystAnswer {
  return toolResultToAnswer(executeLowestComparableCost(dataset));
}

function executeSupplierCoverage(dataset: ComparisonDataset): AnalystToolResult {
  const coverage = getSupplierCoverage(dataset);
  const weakest = [...coverage].sort((a, b) => b.notQuoted - a.notQuoted)[0];
  return {
    toolName: "supplierCoverage",
    title: "Supplier coverage",
    summary: `${weakest.vendorName} has the most incomplete coverage with ${weakest.notQuoted} not-quoted lines.`,
    metrics: coverage.map((item) => ({ label: item.vendorName, value: `${item.quoted}/${dataset.metrics.totalRfxLines} quoted` })),
    evidence: [{ label: "Supplier response queue", detail: "Coverage is calculated from validated extraction results.", href: "/responses" }],
    actions: [{ label: "Review responses", href: "/responses" }, { label: "View exceptions", href: "/exceptions" }],
    caveat: null,
    data: coverage
  };
}

function executeLowestComparableCost(dataset: ComparisonDataset): AnalystToolResult {
  const scenario = calculateScenarios(dataset).find((item) => item.goal === "LOWEST_COMPARABLE_COST") as ScenarioResult;
  return {
    toolName: "lowestComparableCost",
    title: "Lowest comparable cost",
    summary: scenario.estimatedCost === null
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
    actions: [{ label: "View comparison", href: "/comparison" }, { label: "Run scenarios", href: "/scenarios" }],
    caveat: scenario.status === "INSUFFICIENT_DATA" ? "Some lines are excluded because they are not comparison-ready." : null,
    data: scenario
  };
}

function executeSplitAwardScenario(dataset: ComparisonDataset): AnalystToolResult {
  const scenario = calculateScenarios(dataset).find((item) => item.goal === "QUALITY_APPROVED_ONLY") as ScenarioResult;
  return {
    toolName: "splitAwardScenario",
    title: "Quality-approved split award",
    summary: scenario.estimatedCost === null
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
    actions: [{ label: "View scenarios", href: "/scenarios" }, { label: "View comparison", href: "/comparison?filter=ready" }],
    caveat: scenario.status === "INSUFFICIENT_DATA" ? "Some lines are excluded because they are not comparison-ready under quality constraints." : null,
    data: scenario
  };
}

function executePriceSpread(dataset: ComparisonDataset): AnalystToolResult {
  const spreads = getPriceSpreadLines(dataset).slice(0, 5);
  return {
    toolName: "priceSpread",
    title: "Largest price differences",
    summary: spreads.length === 0
      ? "There are not enough ready comparable supplier prices to calculate price spreads."
      : `The largest ready-line price spread is on line ${spreads[0].lineNumber}: ${spreads[0].description}.`,
    metrics: spreads.map((item) => ({ label: `Line ${item.lineNumber}`, value: formatComparisonMoney(item.spread ?? 0, dataset.baseCurrency) })),
    evidence: [{ label: "Ready supplier cells", detail: "Only READY comparison cells are included.", href: "/comparison?filter=ready" }],
    actions: [{ label: "View comparison", href: "/comparison?filter=ready" }],
    caveat: "Lines with unresolved exceptions are excluded from spread calculations.",
    data: spreads
  };
}

function executeExceptions(dataset: ComparisonDataset): AnalystToolResult {
  const exceptions = getLargestExceptions(dataset);
  const top = exceptions.slice(0, 3);
  return {
    toolName: "exceptions",
    title: "Review priorities",
    summary: `${exceptions.length} exception records are affecting comparison readiness. Start with high-severity missing quote, price, currency, unit conversion, and quality issues.`,
    metrics: [
      { label: "High severity", value: String(exceptions.filter((item) => item.severity === "HIGH").length) },
      { label: "Blocked cells", value: String(dataset.metrics.blockedCells) },
      { label: "Review cells", value: String(dataset.metrics.reviewRequiredCells) }
    ],
    evidence: top.map((item) => ({ label: `${item.vendorName} · Line ${item.lineNumber}`, detail: `${item.code}: ${item.message}`, href: "/exceptions" })),
    actions: [{ label: "Open review queue", href: "/exceptions" }, { label: "View comparison", href: "/comparison?filter=blocked" }],
    caveat: null,
    data: exceptions.slice(0, 10)
  };
}

function executeQualityAndCoverage(dataset: ComparisonDataset, args?: Record<string, unknown>): AnalystToolResult {
  const limit = typeof args?.limit === "number" ? args.limit : 5;
  const coverage = getSupplierCoverage(dataset)
    .sort((a, b) => {
      const qualityDelta = qualityRank(b.qualityStatus) - qualityRank(a.qualityStatus);
      return qualityDelta || b.ready - a.ready;
    })
    .slice(0, limit);

  return {
    toolName: "qualityAndCoverage",
    title: "Quality and coverage",
    summary: "Supplier strength is based on existing quality status and quote coverage. The dataset does not include a separate supplier rating score.",
    metrics: coverage.map((item) => ({ label: item.vendorName, value: `${item.qualityStatus} · ${item.ready}/${dataset.metrics.totalRfxLines} ready` })),
    evidence: [
      { label: "Supplier responses", detail: "Coverage is calculated from validated supplier quote cells.", href: "/responses" },
      { label: "Questionnaire status", detail: "Quality status comes from the RFx questionnaire data.", href: "/responses" }
    ],
    actions: [{ label: "Review responses", href: "/responses" }, { label: "View comparison", href: "/comparison" }],
    caveat: "No separate supplier rating field exists in this RFx dataset.",
    data: coverage
  };
}

function executeScenarioAnalysis(dataset: ComparisonDataset): AnalystToolResult {
  const scenarios = calculateScenarios(dataset);
  return {
    toolName: "scenarioAnalysis",
    title: "Scenario analysis",
    summary: "Available sourcing scenarios were calculated with deterministic comparison data.",
    metrics: scenarios.map((scenario) => ({ label: scenario.name, value: scenario.estimatedCost === null ? "Insufficient data" : formatComparisonMoney(scenario.estimatedCost, scenario.currency) })),
    evidence: [{ label: "Scenario workspace", detail: "Scenario results are calculated from normalized comparison data.", href: "/scenarios" }],
    actions: [{ label: "View scenarios", href: "/scenarios" }],
    caveat: scenarios.some((scenario) => scenario.status === "INSUFFICIENT_DATA") ? "Some scenarios exclude lines with unresolved comparison data." : null,
    data: scenarios
  };
}

function executeRatingAvailability(): AnalystToolResult {
  return {
    toolName: "ratingAvailability",
    title: "Supplier rating unavailable",
    summary: "Supplier ratings are not part of this RFx dataset. I can compare suppliers by comparable cost, quote coverage, or quality status instead.",
    metrics: [],
    evidence: [{ label: "Available supplier fields", detail: "The vendor data includes quality status and quote coverage, but no rating score.", href: "/responses" }],
    actions: [{ label: "Compare suppliers", href: "/comparison" }, { label: "Review supplier coverage", href: "/responses" }],
    caveat: "I did not substitute price or coverage for rating because that would overstate the data.",
    data: { ratingAvailable: false }
  };
}

function unsupportedResult(reason = "I couldn't confidently map that question to an available procurement analysis."): AnalystToolResult {
  return {
    toolName: "scenarioAnalysis",
    title: "Analysis not available",
    summary: reason,
    metrics: [],
    evidence: [{ label: "Supported analyses", detail: "Available analyses include cost, coverage, exceptions, price spread, quality status, and split-award scenarios.", href: "/analyst" }],
    actions: [{ label: "View comparison", href: "/comparison" }, { label: "Review exceptions", href: "/exceptions" }],
    caveat: "Try asking about lowest comparable cost, incomplete quotes, quality-approved split award, price differences, or review priorities.",
    data: { unsupported: true, reason }
  };
}

function toolResultToAnswer(result: AnalystToolResult): AnalystAnswer {
  return {
    title: result.title,
    answer: result.summary,
    metrics: result.metrics,
    evidence: result.evidence,
    actions: result.actions,
    caveat: result.caveat
  };
}

function severityRank(severity: "LOW" | "MEDIUM" | "HIGH") {
  return severity === "HIGH" ? 3 : severity === "MEDIUM" ? 2 : 1;
}

function qualityRank(status: string) {
  if (status === "PASS") return 4;
  if (status === "INCOMPLETE") return 3;
  if (status === "NOT_EVALUATED") return 2;
  return 1;
}

function dedupeByHref(items: AnalystAnswer["evidence"]) {
  return items.filter((item, index, all) => all.findIndex((other) => other.href === item.href && other.label === item.label) === index);
}

function dedupeActions(items: AnalystAnswer["actions"]) {
  return items.filter((item, index, all) => all.findIndex((other) => other.href === item.href) === index);
}
