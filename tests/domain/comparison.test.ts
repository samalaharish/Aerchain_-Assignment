import { describe, expect, it } from "vitest";
import { buildComparisonDataset } from "@/lib/domain/comparison";
import { calculateFreight, calculateNormalizedUnitPrice, defaultFxAssumption } from "@/lib/domain/normalization";
import { procurementEvent } from "@/lib/fixtures/procurement-event";
import { runFixtureExtractionWorkflow } from "@/lib/extraction/workflow";
import { MemoryExtractionCache } from "@/lib/extraction/cache";
import { MemoryExtractionRunStore } from "@/lib/extraction/run-store";

describe("Goal 4 deterministic normalization", () => {
  it("preserves original currency while normalizing INR to INR", () => {
    const result = calculateNormalizedUnitPrice({ originalPrice: 82, currency: "INR", unit: "piece", packSize: null });

    expect(result.originalCurrency).toBe("INR");
    expect(result.normalizedCurrency).toBe("INR");
    expect(result.normalizedUnitPrice).toBe(82);
    expect(result.rateSource).toBe(defaultFxAssumption.source);
  });

  it("normalizes USD to INR using deterministic prototype rates", () => {
    const result = calculateNormalizedUnitPrice({ originalPrice: 1.2, currency: "USD", unit: "piece", packSize: null });

    expect(result.status).toBe("NORMALIZED");
    expect(result.exchangeRate).toBe(83.2);
    expect(result.normalizedUnitPrice).toBe(99.84);
  });

  it("normalizes EUR to INR using deterministic prototype rates", () => {
    const result = calculateNormalizedUnitPrice({ originalPrice: 1, currency: "EUR", unit: "piece", packSize: null });

    expect(result.status).toBe("NORMALIZED");
    expect(result.normalizedUnitPrice).toBe(90.1);
  });

  it("normalizes per-100 pricing to per-piece pricing", () => {
    const result = calculateNormalizedUnitPrice({ originalPrice: 700, currency: "INR", unit: "hundred_pieces", packSize: null });

    expect(result.normalizedUnitPrice).toBe(7);
  });

  it("normalizes known carton pack sizes and refuses unknown package conversion", () => {
    const known = calculateNormalizedUnitPrice({ originalPrice: 500, currency: "INR", unit: "carton", packSize: 50 });
    const unknown = calculateNormalizedUnitPrice({ originalPrice: 500, currency: "INR", unit: "carton", packSize: null });

    expect(known.normalizedUnitPrice).toBe(10);
    expect(unknown.status).toBe("UNRESOLVED");
    expect(unknown.reasons).toContain("UNKNOWN_PACK_SIZE");
  });

  it("keeps freight separate and only normalizes deterministic freight", () => {
    const known = calculateFreight({ kind: "excluded", amount: 90, currency: "INR", perUnit: "hundred_pieces" });
    const ambiguous = calculateFreight({ kind: "ambiguous", note: "Freight extra for non-local delivery" });

    expect(known.normalizedUnitPrice).toBe(0.9);
    expect(ambiguous.status).toBe("UNRESOLVED");
    expect(ambiguous.reasons).toContain("AMBIGUOUS_FREIGHT");
  });
});

describe("Goal 4 comparison dataset", () => {
  it("represents 30 RFx lines by 5 vendors without dropping missing quotes", async () => {
    const dataset = await datasetFromDemoExtractions();

    expect(dataset.lines).toHaveLength(30);
    expect(dataset.metrics.vendorCount).toBe(5);
    expect(dataset.metrics.totalCells).toBe(150);
    expect(dataset.lines.every((line) => line.vendors.length === 5)).toBe(true);
    expect(dataset.metrics.notQuotedCells).toBeGreaterThan(0);
  });

  it("does not convert missing quotes into zero", async () => {
    const dataset = await datasetFromDemoExtractions();
    const missing = dataset.lines.flatMap((line) => line.vendors).find((cell) => cell.quoteStatus === "NOT_QUOTED");

    expect(missing).toBeDefined();
    expect(missing?.original.unitPrice).toBeNull();
    expect(missing?.normalized.unitPrice).toBeNull();
    expect(missing?.normalized.landedTotal).toBeNull();
    expect(missing?.exceptions.map((item) => item.code)).toContain("MISSING_QUOTE");
  });

  it("marks clean comparable quotes as READY and ambiguous unit conversions as blocked or review-required", async () => {
    const dataset = await datasetFromDemoExtractions();
    const ready = dataset.lines.flatMap((line) => line.vendors).find((cell) => cell.reviewState === "READY");
    const unitIssue = dataset.lines.flatMap((line) => line.vendors).find((cell) =>
      cell.exceptions.some((exception) => ["UNIT_CONVERSION_REQUIRED", "AMBIGUOUS_UNIT", "UNKNOWN_UNIT"].includes(exception.code))
    );

    expect(ready).toBeDefined();
    expect(unitIssue).toBeDefined();
    expect(["BLOCKED", "REVIEW_REQUIRED"]).toContain(unitIssue?.reviewState);
  });

  it("preserves original supplier values, normalized values, exceptions, and evidence", async () => {
    const dataset = await datasetFromDemoExtractions();
    const vendorDLine21 = dataset.lines.find((line) => line.rfxLineId === "line-21")?.vendors.find((cell) => cell.vendorId === "vendor-d");

    expect(vendorDLine21?.original.currency).toBe("INR");
    expect(vendorDLine21?.original.unitPrice).toBeGreaterThan(0);
    expect(vendorDLine21?.normalized.currency).toBe("INR");
    expect(vendorDLine21?.normalized.unitPrice).toBeGreaterThan(0);
    expect(vendorDLine21?.evidence.length).toBeGreaterThan(0);
    expect(vendorDLine21?.exceptions.map((item) => item.code)).toContain("QUALITY_FAILURE");
  });

  it("calculates deterministic summary metrics and comparable-line coverage", async () => {
    const dataset = await datasetFromDemoExtractions();

    expect(dataset.metrics.readyCells + dataset.metrics.reviewRequiredCells + dataset.metrics.blockedCells).toBe(150);
    expect(dataset.metrics.vendorsWithExceptions).toBeGreaterThan(0);
    expect(dataset.metrics.comparableLines).toBeGreaterThan(0);
    expect(dataset.metrics.supplierLineCells).toBe(150);
    expect(dataset.metrics.rfxLinesWithComparableQuote).toBe(dataset.metrics.comparableLines);
    expect(dataset.metrics.comparableSupplierQuotes).toBe(dataset.metrics.readyCells);
  });

  it("keeps the demo supplier coverage realistic while preserving messy edge cases", async () => {
    const dataset = await datasetFromDemoExtractions();
    const cells = dataset.lines.flatMap((line) => line.vendors);
    const coverageByVendor = Object.fromEntries(procurementEvent.vendors.map((vendor) => [
      vendor.id,
      cells.filter((cell) => cell.vendorId === vendor.id && cell.quoteStatus !== "NOT_QUOTED").length
    ]));

    expect(coverageByVendor["vendor-a"]).toBe(30);
    expect(coverageByVendor["vendor-b"]).toBe(27);
    expect(coverageByVendor["vendor-c"]).toBe(30);
    expect(coverageByVendor["vendor-d"]).toBe(29);
    expect(coverageByVendor["vendor-e"]).toBe(30);
    expect(cells.some((cell) => cell.original.currency === "USD")).toBe(true);
    expect(cells.some((cell) => cell.original.unit === "100 pieces")).toBe(true);
    expect(cells.some((cell) => cell.freight.kind === "ambiguous")).toBe(true);
    expect(cells.some((cell) => cell.exceptions.some((exception) => exception.code === "QUALITY_FAILURE"))).toBe(true);
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
