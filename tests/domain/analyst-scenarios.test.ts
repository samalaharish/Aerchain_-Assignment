import { afterEach, describe, expect, it, vi } from "vitest";
import { answerProcurementAnalystQuestion } from "@/lib/domain/ai-analyst";
import { answerAnalystQuestion, getLargestExceptions, getSupplierCoverage } from "@/lib/domain/analyst-tools";
import { buildComparisonDataset, type ComparisonDataset } from "@/lib/domain/comparison";
import { calculateScenario, calculateScenarios, defaultGoals } from "@/lib/domain/scenarios";
import { procurementEvent } from "@/lib/fixtures/procurement-event";
import { runFixtureExtractionWorkflow } from "@/lib/extraction/workflow";
import { MemoryExtractionCache } from "@/lib/extraction/cache";
import { MemoryExtractionRunStore } from "@/lib/extraction/run-store";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("analyst deterministic tools", () => {
  it("returns supplier coverage from comparison data", async () => {
    const dataset = await datasetFromDemoExtractions();
    const coverage = getSupplierCoverage(dataset);

    expect(coverage).toHaveLength(5);
    expect(coverage.find((item) => item.vendorId === "vendor-d")?.notQuoted).toBeGreaterThan(0);
  });

  it("returns exception priorities with evidence-backed context", async () => {
    const dataset = await datasetFromDemoExtractions();
    const exceptions = getLargestExceptions(dataset);

    expect(exceptions.length).toBeGreaterThan(0);
    expect(exceptions[0].vendorName).toBeTruthy();
    expect(exceptions[0].code).toBeTruthy();
  });

  it("answers lowest comparable cost with deterministic metrics and actions", async () => {
    const dataset = await datasetFromDemoExtractions();
    const answer = answerAnalystQuestion(dataset, "Which supplier has the lowest comparable cost?");

    expect(answer.title).toBe("Lowest comparable cost");
    expect(answer.metrics.some((item) => item.label === "Coverage")).toBe(true);
    expect(answer.evidence.length).toBeGreaterThan(0);
    expect(answer.actions.some((item) => item.href === "/comparison")).toBe(true);
  });

  it("routes quality-approved split-award questions through deterministic scenario tools", async () => {
    const dataset = await datasetFromDemoExtractions();
    const answer = await answerProcurementAnalystQuestion({
      dataset,
      question: "What if we split the award by line, but only among vendors that passed the quality questionnaire?",
      env: {}
    });

    expect(answer.title).toBe("Quality-approved split award");
    expect(answer.mode).toBe("deterministic");
    expect(answer.evidence.some((item) => item.href === "/scenarios")).toBe(true);
    expect(answer.metrics.some((item) => item.label === "Coverage")).toBe(true);
  });

  it("answers supplier coverage and exception questions without arithmetic in prose", async () => {
    const dataset = await datasetFromDemoExtractions();
    const coverage = answerAnalystQuestion(dataset, "Which suppliers have incomplete quotes?");
    const exceptions = answerAnalystQuestion(dataset, "Where are the biggest exceptions?");

    expect(coverage.title).toBe("Supplier coverage");
    expect(exceptions.title).toBe("Review priorities");
  });

  it("routes common analyst questions to the matching deterministic tool instead of the default answer", async () => {
    const dataset = await datasetFromDemoExtractions();

    expect(answerAnalystQuestion(dataset, "Who has the lowest comparable cost?").title).toBe("Lowest comparable cost");
    expect(answerAnalystQuestion(dataset, "Which suppliers have incomplete quotes?").title).toBe("Supplier coverage");
    expect(answerAnalystQuestion(dataset, "Which lines have the largest price differences?").title).toBe("Largest price differences");
    expect(answerAnalystQuestion(dataset, "Which suppliers are strongest on quality and coverage?").title).toBe("Quality and coverage");
  });

  it("does not silently substitute lowest cost for unsupported supplier rating questions", async () => {
    const dataset = await datasetFromDemoExtractions();
    const answer = answerAnalystQuestion(dataset, "Name top 5 suppliers based on their rating");

    expect(answer.title).toBe("Supplier rating unavailable");
    expect(answer.answer).toContain("Supplier ratings are not part of this RFx dataset");
  });

  it("does not silently default unknown questions to lowest comparable cost", async () => {
    const dataset = await datasetFromDemoExtractions();
    const answer = answerAnalystQuestion(dataset, "Can you tell me the weather at each supplier factory?");

    expect(answer.title).toBe("Analysis not available");
    expect(answer.title).not.toBe("Lowest comparable cost");
  });

  it("passes the selected deterministic tool result to the OpenAI explanation step", async () => {
    const dataset = await datasetFromDemoExtractions();
    const explanationPayloads: Record<string, unknown>[] = [];
    let callCount = 0;

    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      callCount += 1;
      const body = JSON.parse(String(init?.body)) as { messages: Array<{ content: string }> };
      if (callCount === 1) {
        return new Response(JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ intent: "SUPPLIER_COVERAGE", metric: "COVERAGE", limit: 5 }) } }]
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      explanationPayloads.push(JSON.parse(body.messages[1].content) as Record<string, unknown>);
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ title: "Coverage explained", answer: "Coverage uses the selected supplier coverage tool.", caveat: null }) } }]
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });

    const answer = await answerProcurementAnalystQuestion({
      dataset,
      question: "Which suppliers have incomplete quotes?",
      env: { ANALYST_PROVIDER: "openai", OPENAI_API_KEY: "test-key", OPENAI_ANALYST_MODEL: "test-model" }
    });

    expect(answer.mode).toBe("openai");
    expect(answer.title).toBe("Coverage explained");
    const explanationPayload = explanationPayloads[0];
    expect(explanationPayload?.deterministicAnswer).toMatchObject({ title: "Supplier coverage" });
    expect(explanationPayload?.toolSummary).toMatchObject({ selectedPlan: { intent: "SUPPLIER_COVERAGE" } });
  });
});

describe("structured goals and scenarios", () => {
  it("calculates lowest comparable, quality-approved, and split-award scenarios", async () => {
    const dataset = await datasetFromDemoExtractions();
    const scenarios = calculateScenarios(dataset);

    expect(scenarios.map((scenario) => scenario.goal)).toEqual([
      "LOWEST_COMPARABLE_COST",
      "QUALITY_APPROVED_ONLY",
      "SPLIT_AWARD"
    ]);
    expect(scenarios.every((scenario) => scenario.coverageLines > 0)).toBe(true);
    expect(scenarios.find((scenario) => scenario.goal === "SPLIT_AWARD")?.allocations.length).toBeGreaterThan(0);
  });

  it("quality-approved scenario excludes failed-quality suppliers", async () => {
    const dataset = await datasetFromDemoExtractions();
    const qualityGoal = defaultGoals.find((goal) => goal.id === "QUALITY_APPROVED_ONLY");
    const scenario = calculateScenario(dataset, qualityGoal!);

    expect(scenario.allocations.every((allocation) => allocation.vendorId !== "vendor-d")).toBe(true);
  });

  it("reports insufficient data rather than inventing scenario outputs", async () => {
    const dataset = emptyDataset();
    const scenario = calculateScenario(dataset, defaultGoals[0]);

    expect(scenario.status).toBe("INSUFFICIENT_DATA");
    expect(scenario.estimatedCost).toBeNull();
    expect(scenario.issues.length).toBe(dataset.metrics.totalRfxLines);
  });
});

async function datasetFromDemoExtractions() {
  const cache = new MemoryExtractionCache();
  const runStore = new MemoryExtractionRunStore();
  const results = await Promise.all(procurementEvent.documents.map((document) =>
    runFixtureExtractionWorkflow(document.id, undefined, cache, runStore)
  ));

  return buildComparisonDataset({
    event: procurementEvent,
    extractions: results.flatMap((result) => result.extraction ? [result.extraction] : []),
    generatedAt: "2026-09-19T00:00:00.000Z"
  });
}

function emptyDataset(): ComparisonDataset {
  return buildComparisonDataset({
    event: procurementEvent,
    extractions: [],
    generatedAt: "2026-09-19T00:00:00.000Z"
  });
}
