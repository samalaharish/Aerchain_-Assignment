import { describe, expect, it } from "vitest";
import { matchRfxLine } from "@/lib/extraction/matching";
import { validateVendorQuoteExtraction } from "@/lib/extraction/schemas";
import { procurementEvent } from "@/lib/fixtures/procurement-event";
import { sha256 } from "@/lib/ingestion/hash";

const validLineIds = new Set(procurementEvent.lineItems.map((line) => line.id));

describe("extraction schema validation", () => {
  it("accepts a valid extraction with evidence", () => {
    const extraction = validExtraction();

    expect(validateVendorQuoteExtraction(extraction, validLineIds).lineItems[0].evidence[0].sourceLocation).toBe("line 1");
  });

  it("rejects unknown RFx line IDs", () => {
    const extraction = validExtraction({ rfxLineId: "line-999" });

    expect(() => validateVendorQuoteExtraction(extraction, validLineIds)).toThrow("Unknown RFx line ID");
  });

  it("rejects invalid confidence", () => {
    const extraction = validExtraction({ confidence: "CERTAIN" });

    expect(() => validateVendorQuoteExtraction(extraction, validLineIds)).toThrow();
  });
});

describe("RFx line matching", () => {
  it("matches exact descriptions", () => {
    const result = matchRfxLine("3-ply brown shipping carton 200x150x120 mm", procurementEvent.lineItems);

    expect(result.status).toBe("MATCHED");
    expect(result.status === "MATCHED" ? result.rfxLineId : null).toBe("line-01");
  });

  it("matches synonym and format variation", () => {
    const result = matchRfxLine("5 layer carton 400*300*250 heavy duty", procurementEvent.lineItems);

    expect(result.status).toBe("MATCHED");
    expect(result.status === "MATCHED" ? result.rfxLineId : null).toBe("line-07");
  });

  it("returns ambiguous for vague descriptions", () => {
    const result = matchRfxLine("fruit tray", procurementEvent.lineItems);

    expect(result.status).toBe("AMBIGUOUS");
  });

  it("returns unknown for unsupported descriptions", () => {
    const result = matchRfxLine("steel bolt M8 zinc", procurementEvent.lineItems);

    expect(result.status).toBe("UNKNOWN");
  });
});

function validExtraction(overrides: Record<string, unknown> = {}) {
  const hash = sha256("evidence");
  const line = {
    rfxLineId: "line-01",
    status: "QUOTED",
    vendorDescription: "3-ply brown shipping carton 200x150x120 mm",
    quotedQuantity: 6000,
    quotedUnit: "per 100 pcs",
    unitPrice: 780,
    currency: "INR",
    leadTimeDays: 21,
    freight: {
      kind: "included",
      amount: null,
      currency: null,
      unit: null,
      notes: "Freight included",
      evidence: [
        {
          documentId: "doc-a",
          text: "Freight included",
          sourceLocation: "line 1",
          parser: "test",
          contentHash: hash
        }
      ]
    },
    notes: null,
    confidence: "HIGH",
    evidence: [
      {
        documentId: "doc-a",
        text: "780 INR / per 100 pcs",
        sourceLocation: "line 1",
        parser: "test",
        contentHash: hash
      }
    ],
    warnings: [],
    ...overrides
  };

  return {
    vendorId: "vendor-a",
    vendorName: "Alpha Packwell",
    documentId: "doc-a",
    extractionMethod: "DETERMINISTIC",
    provider: null,
    model: null,
    lineItems: [line],
    qualityResponses: [],
    commercialTerms: [],
    extractionWarnings: [],
    overallConfidence: "HIGH"
  };
}
