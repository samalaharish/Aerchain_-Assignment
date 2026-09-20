export type AnalystDisplayToolSummary = {
  toolsExecuted?: Array<{ toolName: string }>;
  selectedPlan?: {
    tools?: Array<{ name: string }>;
  };
};

export type AnalystDisplayResponse = {
  metrics: Array<{ label: unknown; value: unknown }>;
  evidence: Array<{ label: unknown; detail: unknown; href: string }>;
  actions: Array<{ label: unknown; href: string }>;
  toolSummary?: AnalystDisplayToolSummary;
};

const singleToolTableNames = new Set([
  "supplierCoverage",
  "lowestComparableCost",
  "priceSpread",
  "exceptions"
]);

const scenarioToolNames = new Set([
  "splitAwardScenario",
  "scenarioAnalysis"
]);

const textOnlyToolNames = new Set([
  "ratingAvailability",
  "qualityAndCoverage"
]);

export function getAnalystDisplay(response: AnalystDisplayResponse) {
  const toolNames = getToolNames(response.toolSummary);
  const uniqueToolNames = Array.from(new Set(toolNames));
  const hasTextOnlyTool = toolNames.some((toolName) => textOnlyToolNames.has(toolName));
  const hasScenarioTool = uniqueToolNames.some((toolName) => scenarioToolNames.has(toolName));
  const hasSingleTableTool = uniqueToolNames.length === 1 && singleToolTableNames.has(uniqueToolNames[0]);
  const showStructured = (!hasTextOnlyTool || hasScenarioTool) && response.metrics.length > 0 && (hasSingleTableTool || hasScenarioTool);

  return {
    toolNames: uniqueToolNames,
    showMetrics: showStructured,
    showSecondaryDetails: showStructured && (response.evidence.length > 0 || response.actions.length > 0)
  };
}

export function formatAnalystDisplayValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.map((item) => formatAnalystDisplayValue(item)).filter(Boolean).join(", ");
  }
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, item]) => `${humanizeKey(key)}: ${formatAnalystDisplayValue(item)}`)
      .filter((line) => !line.endsWith(": "))
      .join("\n");
  }
  return String(value);
}

function getToolNames(toolSummary: AnalystDisplayToolSummary | undefined): string[] {
  const executed = toolSummary?.toolsExecuted?.map((tool) => tool.toolName) ?? [];
  if (executed.length > 0) return executed;
  return toolSummary?.selectedPlan?.tools?.map((tool) => tool.name) ?? [];
}

function humanizeKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
