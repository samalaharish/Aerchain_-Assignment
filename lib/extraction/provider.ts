import type { ProcurementEvent, Vendor } from "@/lib/domain/types";
import type { ParsedDocument } from "@/lib/ingestion/types";
import type { VendorQuoteExtraction } from "@/lib/extraction/schemas";

export type QuoteExtractionProviderInput = {
  event: ProcurementEvent;
  vendor: Vendor;
  parsedDocument: ParsedDocument;
  documentBytes?: Uint8Array;
  mimeType?: string;
};

export type QuoteExtractionProviderResult = {
  extraction: VendorQuoteExtraction;
  requestId: string | null;
  usage: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  } | null;
  latencyMs: number;
};

export type QuoteExtractionProvider = {
  provider: string;
  model: string;
  extractQuote(input: QuoteExtractionProviderInput): Promise<QuoteExtractionProviderResult>;
};
