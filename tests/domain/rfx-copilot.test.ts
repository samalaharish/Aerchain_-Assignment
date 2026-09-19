import { mkdtemp, rm } from "fs/promises";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { generateRfxDraft } from "@/lib/rfx/copilot";
import { readReviewedRfxDraft, writeReviewedRfxDraft } from "@/lib/rfx/draft-store";

describe("RFx copilot", () => {
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
});
