import { z } from "zod";
import {
  analystToolRegistry,
  answerFromToolResults,
  executeAnalystPlan,
  planAnalystQuestionDeterministically,
  type AnalystAnswer,
  type AnalystPlan,
  type AnalystToolName,
  type AnalystToolResult
} from "@/lib/domain/analyst-tools";
import type { ComparisonDataset } from "@/lib/domain/comparison";

export type AnalystMode = "deterministic" | "openai";

export type AiAnalystAnswer = AnalystAnswer & {
  mode: AnalystMode;
  model: string | null;
  toolSummary: Record<string, unknown>;
};

export async function answerProcurementAnalystQuestion(input: {
  dataset: ComparisonDataset;
  question: string;
  history?: string[];
  env?: Record<string, string | undefined>;
}): Promise<AiAnalystAnswer> {
  const env = input.env ?? process.env;
  const model = env.OPENAI_ANALYST_MODEL ?? env.OPENAI_MODEL ?? "gpt-4o-mini";
  const openAiEnabled = env.ANALYST_PROVIDER === "openai" && Boolean(env.OPENAI_API_KEY);
  const plan = openAiEnabled
    ? await planWithOpenAi(input.question, input.history ?? [], model, env.OPENAI_API_KEY as string)
    : planAnalystQuestionDeterministically(input.question, input.history);
  const toolResults = executeAnalystPlan(input.dataset, plan);
  const deterministic = answerFromToolResults(toolResults);
  const toolSummary = buildToolSummary(input.dataset, input.question, input.history ?? [], plan, toolResults);

  if (!openAiEnabled) {
    return {
      ...deterministic,
      mode: "deterministic",
      model: null,
      toolSummary
    };
  }

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
            "Use only the provided deterministic tool results and evidence.",
            "Do not perform arithmetic, invent supplier ratings, invent quote coverage, invent prices, or invent evidence.",
            "If the tool results say data is unavailable, say so plainly.",
            "Return JSON with title, answer, caveat."
          ].join(" ")
        },
        {
          role: "user",
          content: JSON.stringify({
            buyerQuestion: input.question,
            conversationContext: input.history ?? [],
            plannerResult: plan,
            deterministicAnswer: deterministic,
            toolResults,
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

const analystToolNameSchema = z.enum([
  "supplierCoverage",
  "lowestComparableCost",
  "priceSpread",
  "exceptions",
  "qualityAndCoverage",
  "splitAwardScenario",
  "scenarioAnalysis",
  "ratingAvailability"
] satisfies [AnalystToolName, ...AnalystToolName[]]);

const analystPlanSchema = z.object({
  goal: z.string(),
  dataNeeded: z.array(z.string()),
  tools: z.array(z.object({
    name: analystToolNameSchema,
    arguments: z.record(z.unknown()).optional()
  })).max(4),
  constraints: z.array(z.string()),
  unsupportedReason: z.string().nullable().optional()
});

async function planWithOpenAi(question: string, history: string[], model: string, apiKey: string): Promise<AnalystPlan> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "Plan procurement analysis by selecting one or more allowed deterministic tools.",
            "Return only JSON with goal, dataNeeded, tools, constraints, unsupportedReason.",
            "Do not invent facts. Do not calculate numbers.",
            "Use ratingAvailability when the user asks for supplier rating because the tool will verify whether rating exists.",
            "Questions about the most trusted supplier, supplier trust, reputation, ratings, scores, or rankings require an explicit trust/rating field.",
            "Do not substitute quality status, quote coverage, cost, or exceptions for trust/rating unless the buyer explicitly asks to use that metric as a proxy.",
            "For trust/rating/reputation requests, select ratingAvailability to verify whether that data exists.",
            "If no available tool can answer the question, return no tools and set unsupportedReason."
          ].join(" ")
        },
        {
          role: "user",
          content: JSON.stringify({
            buyerQuestion: question,
            conversationContext: history.slice(-8),
            availableTools: analystToolRegistry.map((tool) => ({
              name: tool.name,
              description: tool.description,
              dataProvided: tool.dataProvided
            }))
          })
        }
      ]
    })
  });

  if (!response.ok) return planAnalystQuestionDeterministically(question, history);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string | null } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) return planAnalystQuestionDeterministically(question, history);
  try {
    const parsed = analystPlanSchema.safeParse(JSON.parse(content));
    return parsed.success ? parsed.data : planAnalystQuestionDeterministically(question, history);
  } catch {
    return planAnalystQuestionDeterministically(question, history);
  }
}

function buildToolSummary(
  dataset: ComparisonDataset,
  question: string,
  history: string[],
  plan: AnalystPlan,
  toolResults: AnalystToolResult[]
): Record<string, unknown> {
  return {
    question,
    conversationContext: history.slice(-8),
    selectedPlan: plan,
    metrics: dataset.metrics,
    toolsExecuted: toolResults.map((result) => ({
      toolName: result.toolName,
      title: result.title,
      summary: result.summary,
      metrics: result.metrics,
      caveat: result.caveat,
      evidence: result.evidence
    }))
  };
}
