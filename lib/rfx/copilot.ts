import { z } from "zod";
import { procurementEvent } from "@/lib/fixtures/procurement-event";

export const rfxDraftLineSchema = z.object({
  lineNumber: z.number().int().positive(),
  description: z.string().min(1),
  quantity: z.number().positive().nullable(),
  unit: z.string().min(1).nullable(),
  specification: z.string().min(1).nullable(),
  deliveryLocation: z.string().nullable()
});

export const rfxDraftSchema = z.object({
  status: z.enum(["DRAFT_READY", "NEEDS_CLARIFICATION"]),
  provider: z.enum(["demo", "openai"]),
  model: z.string().nullable(),
  scope: z.string().nullable(),
  lineItems: z.array(rfxDraftLineSchema),
  commercialRequirements: z.array(z.string()),
  questionnaire: z.array(z.string()),
  deliveryRequirements: z.array(z.string()),
  quoteTerms: z.array(z.string()),
  assumptions: z.array(z.string()),
  clarificationQuestions: z.array(z.string())
});

export type RfxDraft = z.infer<typeof rfxDraftSchema>;

export async function generateRfxDraft(input: { prompt: string; env?: Record<string, string | undefined> }): Promise<RfxDraft> {
  const env = input.env ?? process.env;
  const missing = findCriticalGaps(input.prompt);
  if (missing.length > 0 && !allowsAssumptions(input.prompt)) {
    return rfxDraftSchema.parse({
      status: "NEEDS_CLARIFICATION",
      provider: env.OPENAI_API_KEY ? "openai" : "demo",
      model: env.OPENAI_API_KEY ? (env.OPENAI_MODEL ?? "gpt-4o-mini") : null,
      scope: null,
      lineItems: [],
      commercialRequirements: [],
      questionnaire: [],
      deliveryRequirements: [],
      quoteTerms: [],
      assumptions: [],
      clarificationQuestions: missing
    });
  }

  if (env.OPENAI_API_KEY) {
    return generateOpenAiDraft(input.prompt, env);
  }

  return demoDraft(input.prompt, missing);
}

function findCriticalGaps(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  const gaps: string[] = [];
  if (!/(carton|corrugated|box|packaging|sku|item|spec|size|dimension)/.test(lower)) {
    gaps.push("What products or specifications should suppliers quote?");
  }
  if (!/(\d+[\s-]*(sku|line|item|carton|box)|quantity|quantities|qty|around 30|30 carton)/.test(lower)) {
    gaps.push("What quantities or approximate volumes should be quoted?");
  }
  if (!/(west india|india|mumbai|pune|ahmedabad|delivery|fulfillment|warehouse|location|network)/.test(lower)) {
    gaps.push("What delivery location or network should suppliers price freight against?");
  }
  return gaps.slice(0, 3);
}

function allowsAssumptions(prompt: string): boolean {
  return /assumption|assume|draft|around 30|30 carton|west india/i.test(prompt);
}

async function generateOpenAiDraft(prompt: string, env: Record<string, string | undefined>): Promise<RfxDraft> {
  const model = env.OPENAI_RFX_MODEL ?? env.OPENAI_MODEL ?? "gpt-4o-mini";
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
            "You are an RFx copilot for procurement buyers.",
            "Return strict JSON only.",
            "Do not invent critical missing product specs, quantities, units, or delivery locations.",
            "If critical information is missing, return NEEDS_CLARIFICATION with minimal questions.",
            "For non-critical gaps, make editable assumptions."
          ].join(" ")
        },
        {
          role: "user",
          content: `Create a structured RFx draft from this buyer request. JSON fields: status, provider, model, scope, lineItems, commercialRequirements, questionnaire, deliveryRequirements, quoteTerms, assumptions, clarificationQuestions.\n\nBuyer request:\n"""${prompt}"""`
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI RFx copilot failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json() as { choices?: Array<{ message?: { content?: string | null } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI RFx copilot returned no JSON content.");
  const raw = JSON.parse(content) as Record<string, unknown>;
  raw.provider = "openai";
  raw.model = model;
  return rfxDraftSchema.parse(raw);
}

function demoDraft(prompt: string, missing: string[]): RfxDraft {
  const lineItems = procurementEvent.lineItems.map((line) => ({
    lineNumber: line.lineNumber,
    description: line.description,
    quantity: line.quantity,
    unit: line.unit,
    specification: line.specification,
    deliveryLocation: "West India fulfillment network"
  }));

  return rfxDraftSchema.parse({
    status: "DRAFT_READY",
    provider: "demo",
    model: null,
    scope: prompt || procurementEvent.rfx.description,
    lineItems,
    commercialRequirements: [
      "Provide unit price, currency, MOQ, lead time, freight treatment, payment terms, and quote validity.",
      "State whether freight is included or excluded and identify any destination-specific charges."
    ],
    questionnaire: [
      "Confirm valid quality certification.",
      "Confirm board grade and bursting strength compliance.",
      "Disclose any quality exceptions or alternate specifications."
    ],
    deliveryRequirements: [
      "Price delivery for the West India fulfillment network.",
      "Confirm standard lead time in calendar days."
    ],
    quoteTerms: [
      "Return prices by RFx line item.",
      "Do not leave currency, unit, or pack basis implicit."
    ],
    assumptions: missing.length > 0
      ? ["Demo draft uses the existing corrugated packaging RFx and 30 seeded carton SKUs as editable assumptions."]
      : ["Buyer requested a corrugated packaging draft; 30 seeded carton SKUs are used for the assignment demo."],
    clarificationQuestions: []
  });
}
