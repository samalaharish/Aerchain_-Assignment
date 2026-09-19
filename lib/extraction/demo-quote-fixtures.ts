import type { Currency, ProcurementEvent, RfxLineItem, Vendor } from "@/lib/domain/types";
import type { ExtractionEvidence, ExtractedQuoteLine } from "@/lib/extraction/schemas";
import type { ParsedDocument, SourceLocation } from "@/lib/ingestion/types";

type VendorFixtureRule = {
  missingLines: number[];
  currency: Currency;
  unitMode: "piece" | "hundred_pieces" | "box";
  priceFactor: number;
  leadTimeDays: number;
  freightMode: "included" | "excluded";
  freightAmount: number;
  freightUnit: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
};

const vendorRules: Record<string, VendorFixtureRule> = {
  "vendor-a": {
    missingLines: [],
    currency: "INR",
    unitMode: "hundred_pieces",
    priceFactor: 1,
    leadTimeDays: 21,
    freightMode: "included",
    freightAmount: 0,
    freightUnit: "piece",
    confidence: "HIGH"
  },
  "vendor-b": {
    missingLines: [7, 18, 29],
    currency: "USD",
    unitMode: "box",
    priceFactor: 1.04,
    leadTimeDays: 26,
    freightMode: "excluded",
    freightAmount: 0.01,
    freightUnit: "piece",
    confidence: "HIGH"
  },
  "vendor-c": {
    missingLines: [],
    currency: "INR",
    unitMode: "piece",
    priceFactor: 0.96,
    leadTimeDays: 24,
    freightMode: "included",
    freightAmount: 0,
    freightUnit: "piece",
    confidence: "HIGH"
  },
  "vendor-d": {
    missingLines: [26],
    currency: "INR",
    unitMode: "box",
    priceFactor: 0.99,
    leadTimeDays: 30,
    freightMode: "included",
    freightAmount: 0,
    freightUnit: "piece",
    confidence: "MEDIUM"
  },
  "vendor-e": {
    missingLines: [],
    currency: "INR",
    unitMode: "box",
    priceFactor: 1.02,
    leadTimeDays: 28,
    freightMode: "included",
    freightAmount: 0,
    freightUnit: "piece",
    confidence: "LOW"
  }
};

const ambiguousByVendor: Record<string, Record<number, "unit" | "currency" | "freight" | "lead_time" | "price">> = {
  "vendor-b": {
    12: "unit",
    22: "freight"
  },
  "vendor-c": {
    16: "lead_time"
  },
  "vendor-d": {
    9: "unit",
    21: "freight"
  },
  "vendor-e": {
    5: "currency",
    14: "unit",
    27: "price"
  }
};

export function buildDemoQuoteLines(input: {
  event: ProcurementEvent;
  vendor: Vendor;
  parsedDocument: ParsedDocument;
}): ExtractedQuoteLine[] {
  const rule = vendorRules[input.vendor.id] ?? vendorRules["vendor-c"];
  const ambiguous = ambiguousByVendor[input.vendor.id] ?? {};

  return input.event.lineItems.map((line) => {
    if (rule.missingLines.includes(line.lineNumber)) {
      return notQuotedLine(line.id);
    }

    return buildQuotedLine({
      line,
      vendor: input.vendor,
      parsedDocument: input.parsedDocument,
      rule,
      ambiguity: ambiguous[line.lineNumber] ?? null
    });
  });
}

export function buildDemoCommercialTerms(vendorId: string, parsedDocument: ParsedDocument) {
  if (vendorId === "vendor-b") {
    return [
      {
        type: "shipping" as const,
        value: "Freight quoted separately at 0.01 USD per piece except one ambiguous footnote.",
        confidence: "MEDIUM" as const,
        evidence: [evidenceFor(parsedDocument, "Freight quoted separately at 0.01 USD per piece", "commercial shipping term")]
      },
      {
        type: "validity" as const,
        value: "Quote valid for 30 days.",
        confidence: "HIGH" as const,
        evidence: [evidenceFor(parsedDocument, "Quote valid for 30 days", "commercial validity")]
      }
    ];
  }

  if (vendorId === "vendor-d") {
    return [
      {
        type: "other" as const,
        value: "Supplier uses alternate carton descriptions and includes one non-RFx fruit tray note.",
        confidence: "MEDIUM" as const,
        evidence: [evidenceFor(parsedDocument, "fruit tray", "supplier note")]
      }
    ];
  }

  if (vendorId === "vendor-e") {
    return [
      {
        type: "shipping" as const,
        value: "Scanned quotation says freight is included on most rows.",
        confidence: "LOW" as const,
        evidence: [evidenceFor(parsedDocument, "freight included", "image commercial note")]
      }
    ];
  }

  return [
    {
      type: "shipping" as const,
      value: "Freight included in quoted prices.",
      confidence: "HIGH" as const,
      evidence: [evidenceFor(parsedDocument, "Freight included", "commercial shipping term")]
    }
  ];
}

export function evidenceFor(parsedDocument: ParsedDocument, text: string, hint: string): ExtractionEvidence {
  const location = bestLocation(parsedDocument, text);
  return {
    documentId: parsedDocument.documentId,
    text: location?.text?.trim() ? location.text : text,
    page: location?.page,
    sheet: location?.sheet,
    row: location?.row,
    column: location?.column,
    cell: location?.cell,
    line: location?.line,
    sourceLocation: location?.sourceLocation ?? `${parsedDocument.sourceType.toLowerCase()} ${hint}`,
    parser: parsedDocument.parserName,
    contentHash: parsedDocument.contentHash
  };
}

function buildQuotedLine(input: {
  line: RfxLineItem;
  vendor: Vendor;
  parsedDocument: ParsedDocument;
  rule: VendorFixtureRule;
  ambiguity: "unit" | "currency" | "freight" | "lead_time" | "price" | null;
}): ExtractedQuoteLine {
  const packSize = packSizeFor(input.line.lineNumber);
  const perPieceInr = basePerPiecePrice(input.line.lineNumber) * input.rule.priceFactor;
  const unitPrice = unitPriceForMode(perPieceInr, input.rule);
  const roundedPrice = Math.round(unitPrice * 100) / 100;
  const vendorDescription = vendorDescriptionFor(input.vendor.id, input.line);
  const quotedUnit = input.ambiguity === "unit" ? "pack" : unitForMode(input.rule.unitMode);
  const currency = input.ambiguity === "currency" ? null : input.rule.currency;
  const price = input.ambiguity === "price" ? null : roundedPrice;
  const warnings = warningsFor(input.ambiguity);
  const status = input.ambiguity && ["unit", "currency", "price"].includes(input.ambiguity) ? "AMBIGUOUS" : "QUOTED";
  const evidence = evidenceFor(input.parsedDocument, vendorDescription, "supplier quote line");

  return {
    rfxLineId: input.line.id,
    status,
    vendorDescription,
    quotedQuantity: input.line.quantity,
    quotedUnit,
    unitPrice: price,
    currency,
    leadTimeDays: input.ambiguity === "lead_time" ? null : input.rule.leadTimeDays + (input.line.lineNumber % 4),
    freight: freightFor(input.rule, input.ambiguity, input.parsedDocument),
    notes: input.rule.unitMode === "box" && input.ambiguity !== "unit" ? `Supplier indicates pack size ${packSize}.` : noteFor(input.vendor.id, input.line.lineNumber),
    confidence: confidenceFor(input.rule.confidence, input.ambiguity),
    evidence: [evidence],
    warnings
  };
}

function notQuotedLine(rfxLineId: string): ExtractedQuoteLine {
  return {
    rfxLineId,
    status: "NOT_QUOTED",
    vendorDescription: null,
    quotedQuantity: null,
    quotedUnit: null,
    unitPrice: null,
    currency: null,
    leadTimeDays: null,
    freight: {
      kind: "missing",
      amount: null,
      currency: null,
      unit: null,
      notes: null,
      evidence: []
    },
    notes: null,
    confidence: "HIGH",
    evidence: [],
    warnings: ["Supplier did not quote this RFx line."]
  };
}

function freightFor(rule: VendorFixtureRule, ambiguity: string | null, parsedDocument: ParsedDocument): ExtractedQuoteLine["freight"] {
  if (ambiguity === "freight") {
    return {
      kind: "ambiguous",
      amount: null,
      currency: null,
      unit: null,
      notes: "Supplier footnote says freight to be confirmed by destination.",
      evidence: [evidenceFor(parsedDocument, "freight to be confirmed by destination", "freight ambiguity")]
    };
  }

  if (rule.freightMode === "included") {
    return {
      kind: "included",
      amount: null,
      currency: null,
      unit: null,
      notes: "Freight included in quoted unit price.",
      evidence: [evidenceFor(parsedDocument, "Freight included", "freight included")]
    };
  }

  return {
    kind: "excluded",
    amount: rule.freightAmount,
    currency: rule.currency,
    unit: rule.freightUnit,
    notes: "Freight charged separately per piece.",
    evidence: [evidenceFor(parsedDocument, `${rule.freightAmount} ${rule.currency} freight per ${rule.freightUnit}`, "freight excluded")]
  };
}

function basePerPiecePrice(lineNumber: number): number {
  return 6.8 + (lineNumber % 10) * 0.42 + Math.floor(lineNumber / 10) * 0.55;
}

function unitPriceForMode(perPieceInr: number, rule: VendorFixtureRule): number {
  if (rule.currency === "USD") {
    const perPieceUsd = perPieceInr / 83.2;
    if (rule.unitMode === "box") return perPieceUsd * 50;
    if (rule.unitMode === "hundred_pieces") return perPieceUsd * 100;
    return perPieceUsd;
  }
  if (rule.unitMode === "box") return perPieceInr * 50;
  if (rule.unitMode === "hundred_pieces") return perPieceInr * 100;
  return perPieceInr;
}

function unitForMode(mode: VendorFixtureRule["unitMode"]): string {
  if (mode === "hundred_pieces") return "100 pieces";
  if (mode === "box") return "box";
  return "piece";
}

function packSizeFor(lineNumber: number): number {
  return lineNumber % 5 === 0 ? 25 : 50;
}

function vendorDescriptionFor(vendorId: string, line: RfxLineItem): string {
  if (vendorId === "vendor-d") {
    return `${line.specification.replace("Corrugated", "5 layer")} - alternate supplier code D${String(line.lineNumber).padStart(2, "0")}`;
  }
  if (vendorId === "vendor-e") {
    return `Scanned row ${line.lineNumber}: ${line.description}`;
  }
  if (vendorId === "vendor-b") {
    return `${line.description} - PDF quotation item ${line.lineNumber}`;
  }
  return line.description;
}

function noteFor(vendorId: string, lineNumber: number): string | null {
  if (vendorId === "vendor-c" && lineNumber === 16) return "Lead time omitted in supplier email.";
  if (vendorId === "vendor-d" && lineNumber === 21) return "Freight footnote requires buyer confirmation.";
  if (vendorId === "vendor-e" && lineNumber === 27) return "Scanned price is unclear.";
  return null;
}

function confidenceFor(base: "HIGH" | "MEDIUM" | "LOW", ambiguity: string | null): "HIGH" | "MEDIUM" | "LOW" {
  if (ambiguity) return "LOW";
  return base;
}

function warningsFor(ambiguity: string | null): string[] {
  if (ambiguity === "unit") return ["Quoted unit is ambiguous; supplier used pack without stating conversion basis."];
  if (ambiguity === "currency") return ["Currency is missing from the supplier response."];
  if (ambiguity === "freight") return ["Freight applicability is ambiguous."];
  if (ambiguity === "lead_time") return ["Lead time is missing."];
  if (ambiguity === "price") return ["Unit price is unclear in the scanned response."];
  return [];
}

function bestLocation(parsedDocument: ParsedDocument, text: string): SourceLocation | undefined {
  const normalized = text.toLowerCase();
  return parsedDocument.sourceLocations.find((location) => location.text?.toLowerCase().includes(normalized))
    ?? parsedDocument.sourceLocations.find((location) => normalized.includes(location.text?.toLowerCase() ?? "\u0000"))
    ?? parsedDocument.sourceLocations[0];
}
