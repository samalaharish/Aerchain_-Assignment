import { describe, expect, it } from "vitest";
import { getAnalystDisplay } from "@/lib/analyst/display";

describe("analyst display relevance", () => {
  it("does not show generic structured UI for rating-unavailable answers", () => {
    const display = getAnalystDisplay({
      metrics: [{ label: "Available fields", value: "Coverage, quality, cost" }],
      evidence: [{ label: "Available supplier fields", detail: "No rating field exists.", href: "/responses" }],
      actions: [{ label: "Compare suppliers", href: "/comparison" }],
      toolSummary: {
        toolsExecuted: [{ toolName: "ratingAvailability" }]
      }
    });

    expect(display.showMetrics).toBe(false);
    expect(display.showSecondaryDetails).toBe(false);
  });

  it("allows compact structured UI for relevant coverage results", () => {
    const display = getAnalystDisplay({
      metrics: [{ label: "Alpha Packwell", value: "30 / 30 quoted" }],
      evidence: [{ label: "Supplier coverage", detail: "Comparison dataset", href: "/comparison" }],
      actions: [{ label: "Open comparison", href: "/comparison" }],
      toolSummary: {
        toolsExecuted: [{ toolName: "supplierCoverage" }]
      }
    });

    expect(display.showMetrics).toBe(true);
    expect(display.showSecondaryDetails).toBe(true);
  });

  it("keeps quality or trust-style answers text-first even when metrics are present", () => {
    const display = getAnalystDisplay({
      metrics: [{ label: "Alpha Packwell", value: "PASS · 30/30 ready" }],
      evidence: [{ label: "Questionnaire status", detail: "Quality status is available; rating is not.", href: "/responses" }],
      actions: [{ label: "Review responses", href: "/responses" }],
      toolSummary: {
        toolsExecuted: [{ toolName: "qualityAndCoverage" }]
      }
    });

    expect(display.showMetrics).toBe(false);
    expect(display.showSecondaryDetails).toBe(false);
  });

  it("does not render aggregate dashboard metrics for broad multi-tool answers", () => {
    const display = getAnalystDisplay({
      metrics: [
        { label: "High severity", value: "12" },
        { label: "Alpha Packwell", value: "30 / 30 quoted" }
      ],
      evidence: [{ label: "Exceptions", detail: "Review queue", href: "/exceptions" }],
      actions: [{ label: "View comparison", href: "/comparison" }],
      toolSummary: {
        toolsExecuted: [{ toolName: "exceptions" }, { toolName: "supplierCoverage" }]
      }
    });

    expect(display.showMetrics).toBe(false);
    expect(display.showSecondaryDetails).toBe(false);
  });

  it("still allows structured UI for scenario answers", () => {
    const display = getAnalystDisplay({
      metrics: [{ label: "Coverage", value: "28/30 lines" }],
      evidence: [{ label: "Scenario allocation", detail: "Calculated by deterministic code.", href: "/scenarios" }],
      actions: [{ label: "View scenarios", href: "/scenarios" }],
      toolSummary: {
        toolsExecuted: [{ toolName: "splitAwardScenario" }, { toolName: "qualityAndCoverage" }]
      }
    });

    expect(display.showMetrics).toBe(true);
    expect(display.showSecondaryDetails).toBe(true);
  });
});
