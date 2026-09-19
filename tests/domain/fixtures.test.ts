import { describe, expect, it } from "vitest";
import { generateExceptionsForEvent } from "@/lib/domain/exceptions";
import { procurementEvent } from "@/lib/fixtures/procurement-event";

describe("procurement fixture foundation", () => {
  it("contains exactly one RFx with 30 line items and five vendors", () => {
    expect(procurementEvent.rfx.id).toBe("rfx-corrugated-2026");
    expect(procurementEvent.lineItems).toHaveLength(30);
    expect(procurementEvent.vendors).toHaveLength(5);
  });

  it("contains intentionally messy vendor response data", () => {
    const notes = procurementEvent.responses.flatMap((response) => response.messinessNotes).join(" ");

    expect(notes).toContain("freight");
    expect(notes).toContain("missing");
    expect(notes).toContain("alternate");
    expect(notes).toContain("Scanned");
  });

  it("generates deterministic exceptions for incomplete and ambiguous values", () => {
    const exceptions = generateExceptionsForEvent(procurementEvent);
    const codes = new Set(exceptions.map((item) => item.code));

    expect(codes.has("MISSING_PRICE")).toBe(true);
    expect(codes.has("MISSING_CURRENCY")).toBe(true);
    expect(codes.has("UNKNOWN_PACK_SIZE")).toBe(true);
    expect(codes.has("MISSING_LEAD_TIME")).toBe(true);
    expect(codes.has("QUALITY_FAILURE")).toBe(true);
    expect(codes.has("INCOMPLETE_RESPONSE")).toBe(true);
    expect(codes.has("UNMAPPED_LINE_ITEM")).toBe(true);
  });
});
