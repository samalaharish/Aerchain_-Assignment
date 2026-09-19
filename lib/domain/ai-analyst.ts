import { answerAnalystQuestion, type AnalystAnswer } from "@/lib/domain/analyst-tools";
import type { ComparisonDataset } from "@/lib/domain/comparison";
import { calculateScenarios } from "@/lib/domain/scenarios";

export type AnalystMode = "deterministic" | "openai";

export type AiAnalystAnswer = AnalystAnswer & {
  mode: AnalystMode;
  model: string | null;
  toolSummary: Record<string, unknown>;
};

export async function answerProcurementAnalystQuestion(input: {
  dataset: ComparisonDataset;
  question: string;
  env?: Record<string, string | undefined>;
}): Promise<AiAnalystAnswer> {
  const env = input.env ?? process.env;
  const deterministic = answerAnalystQuestion(input.dataset, input.question);
  const toolSummary = buildToolSummary(input.dataset, input.question, deterministic);

  if (env.ANALYST_PROVIDER !== "openai" || !env.OPENAI_API_KEY) {
    return {
      ...deterministic,
      mode: "deterministic",
      model: null,
      toolSummary
    };
  }

  const model = env.OPENAI_ANALYST_MODEL ?? env.OPENAI_MODEL ?? "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You are a procurement analyst.",
            "Use only the provided deterministic tool result.",
            "Do not perform arithmetic or invent supplier data.",
            "Return JSON with title, answer, caveat."
          ].join(" ")
        },
        {
          role: "user",
          content: JSON.stringify({
            buyerQuestion: input.question,
            deterministicAnswer: deterministic,
            toolSummary
          })
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI analyst failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json() as { choices?: Array<{ message?: { content?: string | null } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI analyst returned no JSON content.");
  const parsed = JSON.parse(content) as { title?: string; answer?: string; caveat?: string | null };

  return {
    ...deterministic,
    title: parsed.title || deterministic.title,
    answer: parsed.answer || deterministic.answer,
    caveat: parsed.caveat ?? deterministic.caveat,
    mode: "openai",
    model,
    toolSummary
  };
}

function buildToolSummary(dataset: ComparisonDataset, question: string, answer: AnalystAnswer): Record<string, unknown> {
  const scenarios = calculateScenarios(dataset);
  const splitQuality = scenarios.find((scenario) => scenario.goal === "QUALITY_APPROVED_ONLY");
  return {
    question,
    metrics: dataset.metrics,
    selectedDeterministicAnswer: answer.title,
    scenarios: scenarios.map((scenario) => ({
      id: scenario.id,
      goal: scenario.goal,
      status: scenario.status,
      estimatedCost: scenario.estimatedCost,
      coverageLines: scenario.coverageLines,
      supplierCount: scenario.supplierCount,
      issues: scenario.issues.slice(0, 5)
    })),
    qualityApprovedSplitAward: splitQuality
      ? {
          coverageLines: splitQuality.coverageLines,
          supplierCount: splitQuality.supplierCount,
          estimatedCost: splitQuality.estimatedCost,
          allocations: splitQuality.allocations.slice(0, 10).map((allocation) => ({
            lineNumber: allocation.lineNumber,
            vendorName: allocation.vendorName,
            landedTotal: allocation.landedTotal
          }))
        }
      : null
  };
}
