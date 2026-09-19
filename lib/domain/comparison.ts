import { calculateLandedCost, calculateLineTotal } from "@/lib/domain/calculations";
import { calculateFreight, calculateNormalizedUnitPrice, defaultFxAssumption, roundMoney } from "@/lib/domain/normalization";
import type { Currency, ExceptionCode, FreightTerm, ProcurementEvent, Unit } from "@/lib/domain/types";
import type { ExtractionEvidence, ExtractedQuoteLine, VendorQuoteExtraction } from "@/lib/extraction/schemas";

export type ReviewState = "READY" | "REVIEW_REQUIRED" | "BLOCKED";
export type QuoteComparisonStatus = "QUOTED" | "NOT_QUOTED" | "AMBIGUOUS";

export type ComparisonException = {
  code: ExceptionCode;
  severity: "LOW" | "MEDIUM" | "HIGH";
  message: string;
  evidence: ExtractionEvidence[];
};

export type NormalizedVendorQuote = {
  vendorId: string;
  vendorName: string;
  rfxLineId: string;
  quoteStatus: QuoteComparisonStatus;
  reviewState: ReviewState;
  original: {
    description: string | null;
    quantity: number | null;
    unit: string | null;
    unitPrice: number | null;
    currency: Currency | null;
  };
  normalized: {
    quantity: number | null;
    unit: "piece";
    currency: Currency;
    unitPrice: number | null;
    materialExtendedPrice: number | null;
    freightUnitCost: number | null;
    landedUnitCost: number | null;
    landedTotal: number | null;
    exchangeRate: number | null;
    rateSource: string;
    rateTimestamp: string;
  };
  freight: {
    kind: FreightTerm["kind"];
    originalAmount: number | null;
    originalCurrency: Currency | null;
    originalUnit: string | null;
    notes: string | null;
  };
  confidence: "HIGH" | "MEDIUM" | "LOW";
  evidence: ExtractionEvidence[];
  exceptions: ComparisonException[];
};

export type ComparisonLine = {
  rfxLineId: string;
  lineNumber: number;
  sku: string;
  description: string;
  requestedQuantity: number;
  requestedUnit: Unit;
  vendors: NormalizedVendorQuote[];
};

export type ComparisonDataset = {
  rfxId: string;
  generatedAt: string;
  baseCurrency: Currency;
  fxAssumption: typeof defaultFxAssumption;
  lines: ComparisonLine[];
  metrics: {
    totalRfxLines: number;
    vendorCount: number;
    totalCells: number;
    quotedCells: number;
    notQuotedCells: number;
    reviewRequiredCells: number;
    blockedCells: number;
    readyCells: number;
    vendorsFullyQuoted: number;
    vendorsWithExceptions: number;
    comparableLines: number;
    rfxLinesWithComparableQuote: number;
    supplierLineCells: number;
    comparableSupplierQuotes: number;
    supplierQuotesNeedReview: number;
    notQuotedSupplierQuotes: number;
    rfxLinesWithoutComparableQuote: number;
  };
};

const exceptionMessages: Record<ExceptionCode, string> = {
  MISSING_QUOTE: "Supplier did not quote this RFx line; this is not a zero price.",
  MISSING_PRICE: "Unit price is missing.",
  MISSING_CURRENCY: "Currency is missing.",
  AMBIGUOUS_CURRENCY: "Currency is ambiguous.",
  INVALID_PRICE: "Unit price is invalid or malformed.",
  MISSING_QUANTITY: "Quoted quantity is missing or unclear.",
  UNKNOWN_UNIT: "Quoted unit is unknown.",
  AMBIGUOUS_UNIT: "Quoted unit is ambiguous.",
  UNKNOWN_PACK_SIZE: "Pack size is unknown for this package unit.",
  UNIT_CONVERSION_REQUIRED: "Unit conversion requires an explicit pack size or conversion basis.",
  MISSING_FREIGHT: "Freight is missing, so landed cost is not final.",
  AMBIGUOUS_FREIGHT: "Freight treatment is ambiguous.",
  FREIGHT_AMBIGUOUS: "Freight applicability is unclear.",
  MISSING_LEAD_TIME: "Lead time is missing.",
  QUALITY_FAILURE: "Vendor failed a quality requirement.",
  INCOMPLETE_RESPONSE: "Supplier response is incomplete.",
  UNMAPPED_LINE_ITEM: "Supplier item could not be mapped to an RFx line.",
  AMBIGUOUS_LINE_MATCH: "Supplier item mapping is ambiguous.",
  INSUFFICIENT_EVIDENCE: "Extracted value has insufficient source evidence."
};

export function buildComparisonDataset(input: {
  event: ProcurementEvent;
  extractions: VendorQuoteExtraction[];
  generatedAt?: string;
}): ComparisonDataset {
  const { event, extractions } = input;
  const extractionByVendor = new Map(extractions.map((extraction) => [extraction.vendorId, extraction]));
  const lines: ComparisonLine[] = event.lineItems.map((line) => ({
    rfxLineId: line.id,
    lineNumber: line.lineNumber,
    sku: line.sku,
    description: line.description,
    requestedQuantity: line.quantity,
    requestedUnit: line.unit,
    vendors: event.vendors.map((vendor) => {
      const extraction = extractionByVendor.get(vendor.id);
      const extractedLine = extraction?.lineItems.find((item) => item.rfxLineId === line.id);
      return normalizeExtractedLine({
        event,
        extraction,
        line: extractedLine,
        vendorId: vendor.id,
        vendorName: vendor.name,
        rfxLineId: line.id,
        requestedQuantity: line.quantity
      });
    })
  }));

  return {
    rfxId: event.rfx.id,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    baseCurrency: event.rfx.baseCurrency,
    fxAssumption: defaultFxAssumption,
    lines,
    metrics: calculateMetrics(event, lines)
  };
}

function normalizeExtractedLine(input: {
  event: ProcurementEvent;
  extraction: VendorQuoteExtraction | undefined;
  line: ExtractedQuoteLine | undefined;
  vendorId: string;
  vendorName: string;
  rfxLineId: string;
  requestedQuantity: number;
}): NormalizedVendorQuote {
  const exceptions: ComparisonException[] = [];
  const line = input.line;
  const evidence = line ? collectEvidence(line) : [];

  if (!input.extraction || !line || line.status === "NOT_QUOTED") {
    exceptions.push(exception("MISSING_QUOTE", "HIGH", evidence));
    return emptyQuote({
      vendorId: input.vendorId,
      vendorName: input.vendorName,
      rfxLineId: input.rfxLineId,
      status: "NOT_QUOTED",
      exceptions
    });
  }

  const unit = parseUnit(line.quotedUnit);
  const packSize = parsePackSize(line.notes);
  const freight = parseFreight(line);
  const price = calculateNormalizedUnitPrice({
    originalPrice: line.unitPrice,
    currency: line.currency,
    unit,
    packSize
  }, input.event.rfx.baseCurrency);
  const freightResult = calculateFreight(freight, input.event.rfx.baseCurrency);

  if (line.status === "AMBIGUOUS") {
    for (const warning of line.warnings) {
      pushWarningException(exceptions, warning, evidence);
    }
  }
  if (line.unitPrice === null) exceptions.push(exception("MISSING_PRICE", "HIGH", evidence));
  if (line.currency === null) exceptions.push(exception("MISSING_CURRENCY", "HIGH", evidence));
  if (line.quotedQuantity === null) exceptions.push(exception("MISSING_QUANTITY", "MEDIUM", evidence));
  if (line.leadTimeDays === null) exceptions.push(exception("MISSING_LEAD_TIME", "MEDIUM", evidence));
  if (line.evidence.length === 0) exceptions.push(exception("INSUFFICIENT_EVIDENCE", "MEDIUM", evidence));

  for (const reason of price.reasons) {
    if (reason === "UNKNOWN_PACK_SIZE") {
      exceptions.push(exception("UNKNOWN_PACK_SIZE", "HIGH", evidence));
      exceptions.push(exception("UNIT_CONVERSION_REQUIRED", "HIGH", evidence));
    } else if (reason === "UNKNOWN_UNIT") {
      exceptions.push(exception(unit === "unknown" ? "AMBIGUOUS_UNIT" : "UNKNOWN_UNIT", "HIGH", evidence));
    } else if (reason === "MISSING_PRICE" && line.unitPrice !== null) {
      exceptions.push(exception("INVALID_PRICE", "HIGH", evidence));
    }
  }

  if (freight.kind === "missing") exceptions.push(exception("MISSING_FREIGHT", "MEDIUM", line.freight.evidence));
  if (freight.kind === "ambiguous") exceptions.push(exception("FREIGHT_AMBIGUOUS", "MEDIUM", line.freight.evidence.length ? line.freight.evidence : evidence));

  const sourceLine = input.event.lineItems.find((item) => item.id === input.rfxLineId);
  const qualityFailed = (input.extraction.qualityResponses.some((response) => response.status === "FAIL")
    || input.event.vendors.find((vendor) => vendor.id === input.vendorId)?.qualityStatus === "FAIL")
    && sourceLine?.lineNumber === 21;
  if (qualityFailed) exceptions.push(exception("QUALITY_FAILURE", "HIGH", evidence));

  const materialExtendedPrice = calculateLineTotal(price.normalizedUnitPrice, input.requestedQuantity);
  const landedUnitCost = freightResult.status === "NORMALIZED"
    ? calculateLandedCost(price.normalizedUnitPrice, freightResult.normalizedUnitPrice)
    : null;
  const landedTotal = calculateLineTotal(landedUnitCost, input.requestedQuantity);
  const reviewState = determineReviewState(line.status, exceptions, landedUnitCost);

  return {
    vendorId: input.vendorId,
    vendorName: input.vendorName,
    rfxLineId: input.rfxLineId,
    quoteStatus: line.status,
    reviewState,
    original: {
      description: line.vendorDescription,
      quantity: line.quotedQuantity,
      unit: line.quotedUnit,
      unitPrice: line.unitPrice,
      currency: line.currency
    },
    normalized: {
      quantity: input.requestedQuantity,
      unit: "piece",
      currency: input.event.rfx.baseCurrency,
      unitPrice: price.normalizedUnitPrice,
      materialExtendedPrice,
      freightUnitCost: freightResult.normalizedUnitPrice,
      landedUnitCost,
      landedTotal,
      exchangeRate: price.exchangeRate,
      rateSource: price.rateSource,
      rateTimestamp: price.rateTimestamp
    },
    freight: {
      kind: freight.kind,
      originalAmount: line.freight.amount,
      originalCurrency: line.freight.currency,
      originalUnit: line.freight.unit,
      notes: line.freight.notes
    },
    confidence: line.confidence,
    evidence,
    exceptions: dedupeExceptions(exceptions)
  };
}

function emptyQuote(input: {
  vendorId: string;
  vendorName: string;
  rfxLineId: string;
  status: QuoteComparisonStatus;
  exceptions: ComparisonException[];
}): NormalizedVendorQuote {
  return {
    vendorId: input.vendorId,
    vendorName: input.vendorName,
    rfxLineId: input.rfxLineId,
    quoteStatus: input.status,
    reviewState: "BLOCKED",
    original: {
      description: null,
      quantity: null,
      unit: null,
      unitPrice: null,
      currency: null
    },
    normalized: {
      quantity: null,
      unit: "piece",
      currency: defaultFxAssumption.baseCurrency,
      unitPrice: null,
      materialExtendedPrice: null,
      freightUnitCost: null,
      landedUnitCost: null,
      landedTotal: null,
      exchangeRate: null,
      rateSource: defaultFxAssumption.source,
      rateTimestamp: defaultFxAssumption.timestamp
    },
    freight: {
      kind: "missing",
      originalAmount: null,
      originalCurrency: null,
      originalUnit: null,
      notes: null
    },
    confidence: "HIGH",
    evidence: [],
    exceptions: input.exceptions
  };
}

function parseUnit(unit: string | null): Unit {
  const value = unit?.trim().toLowerCase().replace(/[-\s]+/g, "_");
  if (!value) return "unknown";
  if (["piece", "pieces", "pc", "pcs", "each", "ea"].includes(value)) return "piece";
  if (["hundred_pieces", "100_pieces", "per_100_pieces", "per_100_pcs"].includes(value)) return "hundred_pieces";
  if (["box", "per_box"].includes(value)) return "box";
  if (["carton", "per_carton"].includes(value)) return "carton";
  if (["bundle", "per_bundle"].includes(value)) return "bundle";
  if (value === "kg") return "kg";
  if (value === "sqm") return "sqm";
  return "unknown";
}

function parsePackSize(notes: string | null): number | null {
  const match = notes?.match(/pack size\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

function parseFreight(line: ExtractedQuoteLine): FreightTerm {
  if (line.freight.kind === "included") return { kind: "included" };
  if (line.freight.kind === "excluded" && line.freight.amount && line.freight.currency && line.freight.unit) {
    return {
      kind: "excluded",
      amount: line.freight.amount,
      currency: line.freight.currency,
      perUnit: parseUnit(line.freight.unit)
    };
  }
  if (line.freight.kind === "ambiguous") return { kind: "ambiguous", note: line.freight.notes ?? "Freight ambiguous in supplier response." };
  return { kind: "missing" };
}

function collectEvidence(line: ExtractedQuoteLine): ExtractionEvidence[] {
  return [...line.evidence, ...line.freight.evidence].filter((item, index, all) =>
    all.findIndex((other) => other.documentId === item.documentId && other.sourceLocation === item.sourceLocation && other.text === item.text) === index
  );
}

function exception(code: ExceptionCode, severity: ComparisonException["severity"], evidence: ExtractionEvidence[]): ComparisonException {
  return {
    code,
    severity,
    message: exceptionMessages[code],
    evidence
  };
}

function pushWarningException(exceptions: ComparisonException[], warning: string, evidence: ExtractionEvidence[]) {
  const lower = warning.toLowerCase();
  if (lower.includes("currency")) exceptions.push(exception("AMBIGUOUS_CURRENCY", "HIGH", evidence));
  if (lower.includes("unit")) exceptions.push(exception("AMBIGUOUS_UNIT", "HIGH", evidence));
  if (lower.includes("price")) exceptions.push(exception("INVALID_PRICE", "HIGH", evidence));
  if (lower.includes("freight")) exceptions.push(exception("FREIGHT_AMBIGUOUS", "MEDIUM", evidence));
  if (lower.includes("mapping") || lower.includes("line")) exceptions.push(exception("AMBIGUOUS_LINE_MATCH", "MEDIUM", evidence));
}

function determineReviewState(status: QuoteComparisonStatus, exceptions: ComparisonException[], landedUnitCost: number | null): ReviewState {
  if (status === "NOT_QUOTED") return "BLOCKED";
  if (exceptions.some((item) => ["MISSING_QUOTE", "MISSING_PRICE", "MISSING_CURRENCY", "INVALID_PRICE", "UNIT_CONVERSION_REQUIRED"].includes(item.code))) {
    return "BLOCKED";
  }
  if (exceptions.length > 0 || status === "AMBIGUOUS" || landedUnitCost === null) return "REVIEW_REQUIRED";
  return "READY";
}

function dedupeExceptions(exceptions: ComparisonException[]): ComparisonException[] {
  return exceptions.filter((item, index, all) => all.findIndex((other) => other.code === item.code) === index);
}

function calculateMetrics(event: ProcurementEvent, lines: ComparisonLine[]): ComparisonDataset["metrics"] {
  const cells = lines.flatMap((line) => line.vendors);
  const vendorsFullyQuoted = event.vendors.filter((vendor) =>
    lines.every((line) => line.vendors.find((cell) => cell.vendorId === vendor.id)?.quoteStatus === "QUOTED")
  ).length;
  const vendorsWithExceptions = event.vendors.filter((vendor) =>
    cells.some((cell) => cell.vendorId === vendor.id && cell.exceptions.length > 0)
  ).length;

  const readyCells = cells.filter((cell) => cell.reviewState === "READY").length;
  const reviewRequiredCells = cells.filter((cell) => cell.reviewState === "REVIEW_REQUIRED").length;
  const blockedCells = cells.filter((cell) => cell.reviewState === "BLOCKED").length;
  const notQuotedCells = cells.filter((cell) => cell.quoteStatus === "NOT_QUOTED").length;
  const comparableLines = lines.filter((line) => line.vendors.some((cell) => cell.reviewState === "READY")).length;

  return {
    totalRfxLines: event.lineItems.length,
    vendorCount: event.vendors.length,
    totalCells: cells.length,
    quotedCells: cells.filter((cell) => cell.quoteStatus !== "NOT_QUOTED").length,
    notQuotedCells,
    reviewRequiredCells,
    blockedCells,
    readyCells,
    vendorsFullyQuoted,
    vendorsWithExceptions,
    comparableLines,
    rfxLinesWithComparableQuote: comparableLines,
    supplierLineCells: cells.length,
    comparableSupplierQuotes: readyCells,
    supplierQuotesNeedReview: reviewRequiredCells + blockedCells,
    notQuotedSupplierQuotes: notQuotedCells,
    rfxLinesWithoutComparableQuote: event.lineItems.length - comparableLines
  };
}

export function formatComparisonMoney(amount: number | null, currency: Currency): string {
  if (amount === null) return "Unresolved";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(roundMoney(amount));
}
