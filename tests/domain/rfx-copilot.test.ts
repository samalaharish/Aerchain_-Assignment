import { mkdtemp, rm } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateRfxDraft } from "@/lib/rfx/copilot";
import { readReviewedRfxDraft, writeReviewedRfxDraft } from "@/lib/rfx/draft-store";
import { PUT as saveRfxDraft } from "@/app/api/rfx-draft/route";
import { POST as submitRfx } from "@/app/api/rfx-submit/route";

describe("RFx copilot", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("turns a natural-language sourcing request into a structured editable draft in demo mode", async () => {
    const draft = await generateRfxDraft({
      prompt: "I need corrugated packaging for our West India fulfillment network. We need around 30 carton SKUs. Ask suppliers for pricing, MOQ, lead time, freight and quality information.",
      env: {}
    });

    expect(draft.status).toBe("DRAFT_READY");
    expect(draft.provider).toBe("demo");
    expect(draft.lineItems).toHaveLength(30);
    expect(draft.commercialRequirements.join(" ")).toContain("freight");
    expect(draft.questionnaire.length).toBeGreaterThan(0);
  });

  it("asks minimal clarification questions when critical RFx information is missing", async () => {
    const draft = await generateRfxDraft({
      prompt: "I need suppliers to quote something soon.",
      env: {}
    });

    expect(draft.status).toBe("NEEDS_CLARIFICATION");
    expect(draft.clarificationQuestions.length).toBeGreaterThan(0);
    expect(draft.lineItems).toHaveLength(0);
  });

  it("persists a buyer-edited RFx line in the reviewed draft store", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "rfx-draft-"));
    const filePath = path.join(directory, "reviewed-rfx-draft.json");
    try {
      const draft = await generateRfxDraft({
        prompt: "I need corrugated packaging for our West India fulfillment network. We need around 30 carton SKUs.",
        env: {}
      });
      const edited = {
        ...draft,
        lineItems: draft.lineItems.map((line) => line.lineNumber === 1
          ? { ...line, description: "Buyer edited 5-ply carton", quantity: 12345, deliveryLocation: "Pune DC" }
          : line)
      };

      await writeReviewedRfxDraft(edited, { filePath });
      const saved = await readReviewedRfxDraft({ filePath });

      expect(saved?.lineItems.find((line) => line.lineNumber === 1)?.description).toBe("Buyer edited 5-ply carton");
      expect(saved?.lineItems.find((line) => line.lineNumber === 1)?.quantity).toBe(12345);
      expect(saved?.lineItems.find((line) => line.lineNumber === 1)?.deliveryLocation).toBe("Pune DC");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("requests and validates the strict OpenAI RFxDraft contract for a 30-line draft", async () => {
    const openAiDraft = {
      status: "DRAFT_READY",
      provider: "openai",
      model: "gpt-4o-mini",
      scope: "Corrugated packaging for West India fulfillment network.",
      lineItems: Array.from({ length: 30 }, (_, index) => ({
        lineNumber: index + 1,
        description: `Corrugated carton SKU ${index + 1}`,
        quantity: 5000 + index,
        unit: "piece",
        specification: `Editable carton specification ${index + 1}`,
        deliveryLocation: "West India fulfillment network"
      })),
      commercialRequirements: ["Provide unit price, MOQ, lead time, freight, payment terms, and quote validity."],
      questionnaire: ["Confirm quality certification.", "Confirm specification compliance."],
      deliveryRequirements: ["Deliver to the West India fulfillment network."],
      quoteTerms: ["Quote each RFx line separately."],
      assumptions: ["Quantities are editable buyer assumptions until approved."],
      clarificationQuestions: []
    };
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        response_format?: {
          type?: string;
          json_schema?: {
            strict?: boolean;
            schema?: {
              properties?: Record<string, { type?: unknown; enum?: unknown; items?: { properties?: Record<string, unknown> } }>;
            };
          };
        };
      };
      expect(body.response_format?.type).toBe("json_schema");
      expect(body.response_format?.json_schema?.strict).toBe(true);
      expect(body.response_format?.json_schema?.schema?.properties?.status?.enum).toEqual(["DRAFT_READY", "NEEDS_CLARIFICATION"]);
      expect(body.response_format?.json_schema?.schema?.properties?.commercialRequirements?.type).toBe("array");
      expect(body.response_format?.json_schema?.schema?.properties?.deliveryRequirements?.type).toBe("array");
      expect(body.response_format?.json_schema?.schema?.properties?.quoteTerms?.type).toBe("array");
      expect(body.response_format?.json_schema?.schema?.properties?.assumptions?.type).toBe("array");
      const lineProperties = body.response_format?.json_schema?.schema?.properties?.lineItems?.items?.properties;
      expect(lineProperties).toHaveProperty("lineNumber");
      expect(lineProperties).toHaveProperty("specification");
      expect(lineProperties).toHaveProperty("deliveryLocation");

      return new Response(JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify(openAiDraft)
            }
          }
        ]
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const draft = await generateRfxDraft({
      prompt: "I need corrugated packaging for our West India fulfillment network. We need around 30 carton SKUs. Ask suppliers for pricing, MOQ, lead time, freight and quality information.",
      env: {
        OPENAI_API_KEY: "test-key",
        OPENAI_MODEL: "gpt-4o-mini"
      }
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(draft.status).toBe("DRAFT_READY");
    expect(draft.provider).toBe("openai");
    expect(draft.lineItems).toHaveLength(30);
    expect(draft.lineItems[0]).toMatchObject({
      lineNumber: 1,
      specification: "Editable carton specification 1",
      deliveryLocation: "West India fulfillment network"
    });
    expect(Array.isArray(draft.commercialRequirements)).toBe(true);
    expect(Array.isArray(draft.deliveryRequirements)).toBe(true);
    expect(Array.isArray(draft.quoteTerms)).toBe(true);
    expect(Array.isArray(draft.assumptions)).toBe(true);
  });

  it("uses Supabase for RFx save and submit when server env is configured", async () => {
    const originalUrl = process.env.SUPABASE_URL;
    const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";

    const state = new Map<string, unknown>();
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const requestUrl = String(url);
      expect(requestUrl).toContain("https://example.supabase.co/rest/v1/app_state");

      if (!init?.method || init.method === "GET") {
        const key = new URL(requestUrl).searchParams.get("key")?.replace(/^eq\./, "");
        const value = key ? state.get(key) : null;
        return new Response(JSON.stringify(value ? [{ value }] : []), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      const body = JSON.parse(String(init.body)) as { key: string; value: unknown };
      state.set(body.key, body.value);
      return new Response(null, { status: 204 });
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      const draft = await generateRfxDraft({
        prompt: "I need corrugated packaging for our West India fulfillment network. We need around 30 carton SKUs.",
        env: {}
      });

      const saveResponse = await saveRfxDraft(new Request("http://localhost/api/rfx-draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft })
      }));
      expect(saveResponse.status).toBe(200);
      expect(state.get("reviewed-rfx-draft")).toMatchObject({ status: "DRAFT_READY" });
      expect(state.get("rfx-workflow-state")).toMatchObject({ status: "READY_TO_SEND" });

      const submitResponse = await submitRfx();
      expect(submitResponse.status).toBe(200);
      expect(state.get("rfx-workflow-state")).toMatchObject({
        status: "SENT",
        supplierCount: 5,
        lineCount: 30,
        channel: "Email"
      });
      expect(fetchMock).toHaveBeenCalled();
    } finally {
      restoreEnv("SUPABASE_URL", originalUrl);
      restoreEnv("SUPABASE_SERVICE_ROLE_KEY", originalKey);
    }
  });
});

function restoreEnv(key: "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY", value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
