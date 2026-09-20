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

const structuredToolNames = new Set([
  "supplierCoverage",
  "lowestComparableCost",
  "priceSpread",
  "exceptions",
  "qualityApprovedSuppliers",
  "qualityAndCoverage",
  "splitAwardScenario",
  "scenarioAnalysis"
]);

const textOnlyToolNames = new Set(["ratingAvailability"]);

export function getAnalystDisplay(response: AnalystDisplayResponse) {
  const toolNames = getToolNames(response.toolSummary);
  const hasStructuredTool = toolNames.some((toolName) => structuredToolNames.has(toolName));
  const hasTextOnlyTool = toolNames.some((toolName) => textOnlyToolNames.has(toolName));
  const showStructured = hasStructuredTool && !hasTextOnlyTool && response.metrics.length > 0;

  return {
    toolNames,
    showMetrics: showStructured,
    showSecondaryDetails: showStructured && (response.evidence.length > 0 || response.actions.length > 0)
  };
}

function getToolNames(toolSummary: AnalystDisplayToolSummary | undefined): string[] {
  const executed = toolSummary?.toolsExecuted?.map((tool) => tool.toolName) ?? [];
  if (executed.length > 0) return executed;
  return toolSummary?.selectedPlan?.tools?.map((tool) => tool.name) ?? [];
}
