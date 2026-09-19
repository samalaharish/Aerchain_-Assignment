import { describe, expect, it } from "vitest";
import { calculateComparableQuote, calculateLandedCost, calculateLineTotal } from "@/lib/domain/calculations";
import { calculateFreight, calculateNormalizedUnitPrice } from "@/lib/domain/normalization";
import { procurementEvent } from "@/lib/fixtures/procurement-event";

describe("deterministic normalization", () => {
  it("normalizes INR per 100 pieces into INR per piece", () => {
    const result = calculateNormalizedUnitPrice({
      originalPrice: 950,
      currency: "INR",
      unit: "hundred_pieces",
      packSize: null
    });

    expect(result.status).toBe("NORMALIZED");
    expect(result.normalizedUnitPrice).toBe(9.5);
  });

  it("uses known pack size for box conversion", () => {
    const result = calculateNormalizedUnitPrice({
      originalPrice: 500,
      currency: "INR",
      unit: "box",
      packSize: 50
    });

    expect(result.status).toBe("NORMALIZED");
    expect(result.normalizedUnitPrice).toBe(10);
  });

  it("does not guess unknown pack size", () => {
    const result = calculateNormalizedUnitPrice({
      originalPrice: 16,
      currency: "INR",
      unit: "box",
      packSize: null
    });

    expect(result.status).toBe("UNRESOLVED");
    expect(result.normalizedUnitPrice).toBeNull();
    expect(result.reasons).toContain("UNKNOWN_PACK_SIZE");
  });

  it("converts currency using explicit FX assumptions", () => {
    const result = calculateNormalizedUnitPrice({
      originalPrice: 1,
      currency: "USD",
      unit: "piece",
      packSize: null
    });

    expect(result.status).toBe("NORMALIZED");
    expect(result.normalizedUnitPrice).toBe(83.2);
  });

  it("returns unresolved when currency is missing", () => {
    const result = calculateNormalizedUnitPrice({
      originalPrice: 10,
      currency: null,
      unit: "piece",
      packSize: null
    });

    expect(result.status).toBe("UNRESOLVED");
    expect(result.reasons).toContain("MISSING_CURRENCY");
  });

  it("returns unresolved when price is missing", () => {
    const result = calculateNormalizedUnitPrice({
      originalPrice: null,
      currency: "INR",
      unit: "piece",
      packSize: null
    });

    expect(result.status).toBe("UNRESOLVED");
    expect(result.reasons).toContain("MISSING_PRICE");
  });

  it("returns unresolved for unsupported unit mismatch", () => {
    const result = calculateNormalizedUnitPrice({
      originalPrice: 40,
      currency: "INR",
      unit: "kg",
      packSize: null
    });

    expect(result.status).toBe("UNRESOLVED");
    expect(result.reasons).toContain("UNKNOWN_UNIT");
  });

  it("calculates freight per piece when provided", () => {
    const result = calculateFreight({ kind: "excluded", amount: 90, currency: "INR", perUnit: "hundred_pieces" });

    expect(result.status).toBe("NORMALIZED");
    expect(result.normalizedUnitPrice).toBe(0.9);
  });

  it("calculates landed cost", () => {
    expect(calculateLandedCost(9.5, 0.9)).toBe(10.4);
  });

  it("does not calculate line total with missing values", () => {
    expect(calculateLineTotal(null, 1000)).toBeNull();
  });

  it("flags quality failure in comparable quote", () => {
    const failedQuote = procurementEvent.quoteLineItems.find((quote) => quote.vendorId === "vendor-d");

    expect(failedQuote).toBeDefined();
    const comparable = calculateComparableQuote(procurementEvent, failedQuote!);

    expect(comparable.status).toBe("UNRESOLVED");
    expect(comparable.exceptions).toContain("QUALITY_FAILURE");
  });
});
