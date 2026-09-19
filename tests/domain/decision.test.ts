import { describe, expect, it } from "vitest";
import { buildComparisonDataset } from "@/lib/domain/comparison";
import { createDecisionRecord, transitionDecisionStatus } from "@/lib/domain/decision";
import { calculateScenarios } from "@/lib/domain/scenarios";
import { procurementEvent } from "@/lib/fixtures/procurement-event";

describe("decision workflow", () => {
  it("creates an auditable lightweight decision record", () => {
    const dataset = buildComparisonDataset({
      event: procurementEvent,
      extractions: [],
      generatedAt: "2026-09-19T00:00:00.000Z"
    });
    const scenario = calculateScenarios(dataset)[0];
    const record = createDecisionRecord({
      dataset,
      scenario,
      status: "DRAFT",
      now: "2026-09-19T01:00:00.000Z"
    });

    expect(record.status).toBe("DRAFT");
    expect(record.rfxId).toBe(procurementEvent.rfx.id);
    expect(record.scenarioId).toBe(scenario.id);
    expect(record.assumptions.length).toBeGreaterThan(0);
    expect(record.evidenceLinks.some((link) => link.href === "/comparison")).toBe(true);
  });

  it("keeps approval human-controlled through explicit state transitions", () => {
    expect(transitionDecisionStatus("DRAFT", "READY_FOR_REVIEW")).toBe("READY_FOR_REVIEW");
    expect(transitionDecisionStatus("READY_FOR_REVIEW", "APPROVED")).toBe("APPROVED");
    expect(transitionDecisionStatus("APPROVED", "RETURNED")).toBe("RETURNED");
    expect(() => transitionDecisionStatus("DRAFT", "APPROVED")).toThrow(/Invalid decision transition/);
  });
});
