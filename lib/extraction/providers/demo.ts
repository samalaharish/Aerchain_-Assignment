import type { ProcurementEvent, Vendor } from "@/lib/domain/types";
import type { VendorQuoteExtraction } from "@/lib/extraction/schemas";
import { validateVendorQuoteExtraction } from "@/lib/extraction/schemas";
import { buildDemoCommercialTerms, buildDemoQuoteLines, evidenceFor } from "@/lib/extraction/demo-quote-fixtures";
import type { QuoteExtractionProvider, QuoteExtractionProviderInput, QuoteExtractionProviderResult } from "@/lib/extraction/provider";
import type { ParsedDocument } from "@/lib/ingestion/types";

export class DemoExtractionProvider implements QuoteExtractionProvider {
  provider = "demo";
  model = "demo-extractor";

  async extractQuote(input: QuoteExtractionProviderInput): Promise<QuoteExtractionProviderResult> {
    const started = Date.now();
    const extraction = buildDemoExtraction(input.event, input.vendor, input.parsedDocument);
    const validLineIds = new Set(input.event.lineItems.map((line) => line.id));

    return {
      extraction: validateVendorQuoteExtraction(extraction, validLineIds),
      requestId: null,
      usage: null,
      latencyMs: Date.now() - started
    };
  }
}

function buildDemoExtraction(event: ProcurementEvent, vendor: Vendor, parsedDocument: ParsedDocument): VendorQuoteExtraction {
  const lineItems = buildDemoQuoteLines({ event, vendor, parsedDocument });

  const qualityResponses = event.questionnaireAnswers
    .filter((answer) => answer.vendorId === vendor.id)
    .map((answer) => ({
      questionCode: answer.questionCode,
      question: answer.question,
      answer: answer.answer,
      status: answer.status,
      confidence: "MEDIUM" as const,
      evidence: [evidenceFor(parsedDocument, answer.answer ?? answer.question, "quality response")]
    }));

  const commercialTerms = buildDemoCommercialTerms(vendor.id, parsedDocument);
  const extractionWarnings = extractionWarningsFor(vendor.id);

  return {
    vendorId: vendor.id,
    vendorName: vendor.name,
    documentId: parsedDocument.documentId,
    extractionMethod: "AI_DEMO",
    provider: "demo",
    model: "demo-extractor",
    lineItems,
    qualityResponses,
    commercialTerms,
    extractionWarnings,
    overallConfidence: vendor.id === "vendor-e" ? "LOW" : vendor.id === "vendor-d" ? "MEDIUM" : "HIGH"
  };
}

function extractionWarningsFor(vendorId: string): string[] {
  if (vendorId === "vendor-d") {
    return [
      "Demo extraction: simulated provider output based on seeded fixture data.",
      "Supplier includes one unmapped fruit tray line that is not assigned to an RFx line.",
      "Quality questionnaire indicates a failed/current-certificate issue."
    ];
  }

  if (vendorId === "vendor-e") {
    return [
      "Demo extraction: simulated multimodal output based on seeded scanned-image fixture data.",
      "Image fixture has lower confidence and missing currency/lead-time fields."
    ];
  }

  return ["Demo extraction: simulated provider output based on seeded fixture data."];
}
