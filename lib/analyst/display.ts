export type AnalystDisplayToolSummary = {
  toolsExecuted?: Array<{ toolName: string }>;
  selectedPlan?: {
    tools?: Array<{ name: string }>;
  };
};

export type AnalystDisplayResponse = {
  metrics: Array<{ label: string; value: string }>;
  evidence: Array<{ label: string; detail: string; href: string }>;
  actions: Array<{ label: string; href: string }>;
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

function getToolNames(toolSummary: AnalystDisplayToolSummary | undefined): string[] {
  const executed = toolSummary?.toolsExecuted?.map((tool) => tool.toolName) ?? [];
  if (executed.length > 0) return executed;
  return toolSummary?.selectedPlan?.tools?.map((tool) => tool.name) ?? [];
}
