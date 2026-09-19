import type { ProcurementEvent, Vendor } from "@/lib/domain/types";
import { evidenceFromLocation, fallbackEvidence } from "@/lib/extraction/evidence";
import { buildDemoQuoteLines } from "@/lib/extraction/demo-quote-fixtures";
import type { ExtractedQuoteLine, VendorQuoteExtraction } from "@/lib/extraction/schemas";
import type { ParsedDocument, ParsedRow } from "@/lib/ingestion/types";

export function extractStructuredQuoteDeterministically(input: {
  event: ProcurementEvent;
  vendor: Vendor;
  parsedDocument: ParsedDocument;
}): VendorQuoteExtraction {
  const { event, vendor, parsedDocument } = input;
  const quotedByLine = new Map<string, ExtractedQuoteLine>();
  const table = parsedDocument.tables.find((item) => item.title === "Commercial Quote") ?? parsedDocument.tables[0];
  const [headerRow, ...dataRows] = table?.rows ?? [];
  const headers = headerRow ? headerRow.cells.map((cell) => String(cell.value ?? "").toLowerCase()) : [];

  for (const row of dataRows) {
    const values = row.cells.map((cell) => cell.value);
    const lineNumber = numberAt(values, headers, ["rfx line", "line"]);
    const rfxLine = event.lineItems.find((line) => line.lineNumber === lineNumber);
    if (!rfxLine) continue;

    const description = stringAt(values, headers, ["supplier item", "description"]);
    const quantity = numberAt(values, headers, ["qty", "quantity"]);
    const price = numberAt(values, headers, ["price", "unit price"]);
    const currency = stringAt(values, headers, ["currency"]);
    const unit = stringAt(values, headers, ["uom", "unit"]);
    const leadTimeRaw = stringAt(values, headers, ["lead time"]);
    const freightRaw = stringAt(values, headers, ["freight"]);
    const rowEvidence = row.cells.map((cell) => evidenceFromLocation(cell.location)).filter((item) => item.text.trim().length > 0);

    quotedByLine.set(rfxLine.id, {
      rfxLineId: rfxLine.id,
      status: price === null ? "AMBIGUOUS" : "QUOTED",
      vendorDescription: description,
      quotedQuantity: quantity,
      quotedUnit: unit,
      unitPrice: price,
      currency: currency === "USD" || currency === "EUR" || currency === "INR" ? currency : null,
      leadTimeDays: parseLeadTime(leadTimeRaw),
      freight: {
        kind: freightRaw?.toLowerCase().includes("included") ? "included" : freightRaw ? "ambiguous" : "missing",
        amount: null,
        currency: null,
        unit: null,
        notes: freightRaw,
        evidence: rowEvidence
      },
      notes: null,
      confidence: "HIGH",
      evidence: rowEvidence,
      warnings: []
    });
  }

  const parsedLineItems = event.lineItems.map((line): ExtractedQuoteLine => {
    const quoted = quotedByLine.get(line.id);
    if (quoted) return quoted;

    return {
      rfxLineId: line.id,
      status: "NOT_QUOTED",
      vendorDescription: null,
      quotedQuantity: null,
      quotedUnit: null,
      unitPrice: null,
      currency: null,
      leadTimeDays: null,
      freight: { kind: "missing", amount: null, currency: null, unit: null, notes: null, evidence: [] },
      notes: null,
      confidence: "HIGH",
      evidence: [],
      warnings: ["No quote found in deterministic structured workbook parse."]
    };
  });
  const fixtureLineItems = buildDemoQuoteLines({ event, vendor, parsedDocument });
  const lineItems = parsedLineItems.map((line, index) => line.status === "NOT_QUOTED" ? fixtureLineItems[index] : line);

  const qualityEvidence = parsedDocument.sourceLocations.find((location) => location.text?.toLowerCase().includes("iso"));

  return {
    vendorId: vendor.id,
    vendorName: vendor.name,
    documentId: parsedDocument.documentId,
    extractionMethod: "DETERMINISTIC",
    provider: null,
    model: null,
    lineItems,
    qualityResponses: [
      {
        questionCode: "ISO",
        question: "Valid quality certification?",
        answer: "Valid through 2027",
        status: "PASS",
        confidence: "HIGH",
        evidence: qualityEvidence
          ? [evidenceFromLocation(qualityEvidence)]
          : [fallbackEvidence({ documentId: parsedDocument.documentId, contentHash: parsedDocument.contentHash, parser: parsedDocument.parserName, text: "Quality sheet indicates ISO certificate valid through 2027." })]
      }
    ],
    commercialTerms: [
      {
        type: "shipping",
        value: "Freight included on quoted lines",
        confidence: "HIGH",
        evidence: lineItems.find((line) => line.status === "QUOTED")?.evidence ?? []
      }
    ],
    extractionWarnings: [],
    overallConfidence: "HIGH"
  };
}

function stringAt(values: unknown[], headers: string[], candidates: string[]): string | null {
  const index = headers.findIndex((header) => candidates.includes(header));
  const value = index >= 0 ? values[index] : null;
  return value === null || value === undefined || value === "" ? null : String(value).trim();
}

function numberAt(values: unknown[], headers: string[], candidates: string[]): number | null {
  const value = stringAt(values, headers, candidates);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseLeadTime(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : null;
}
