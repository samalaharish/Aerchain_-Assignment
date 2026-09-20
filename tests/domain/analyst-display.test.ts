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
});
