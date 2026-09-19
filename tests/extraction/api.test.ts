import { describe, expect, it } from "vitest";
import { runExtractionApi } from "@/lib/extraction/api";
import type { ExtractionWorkflowResult } from "@/lib/extraction/workflow";

describe("extraction API helper", () => {
  it("returns a workflow result without requiring the route to know provider details", async () => {
    const result = await runExtractionApi("doc-test", async (documentId) => workflowResult(documentId));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.documentId).toBe("doc-test");
      expect(result.result.status).toBe("AI_PENDING");
      expect(result.result.run.error).toBe("GEMINI_API_KEY is not configured.");
    }
  });

  it("returns structured errors for unknown documents", async () => {
    const result = await runExtractionApi("missing-doc", async () => {
      throw new Error("Unknown fixture document: missing-doc");
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("Unknown fixture document");
    }
  });
});

function workflowResult(documentId: string): ExtractionWorkflowResult {
  return {
    documentId,
    vendorId: "vendor-d",
    status: "AI_PENDING",
    path: "AI_PROVIDER",
    reason: "Ambiguous text requires Gemini extraction. GEMINI_API_KEY is not configured.",
    cacheHit: false,
    cacheKey: "cache-key",
    extraction: null,
    run: {
      provider: "gemini",
      model: "gemini-2.0-flash",
      requestId: null,
      latencyMs: null,
      error: "GEMINI_API_KEY is not configured.",
      startedAt: "2026-09-19T00:00:00.000Z",
      completedAt: null
    }
  };
}
