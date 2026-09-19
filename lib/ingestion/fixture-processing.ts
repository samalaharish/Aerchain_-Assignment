import { readFile } from "fs/promises";
import path from "path";
import { ParserCache } from "@/lib/ingestion/cache";
import { processDocument } from "@/lib/ingestion/processor";
import { procurementEvent } from "@/lib/fixtures/procurement-event";

export type VendorDocumentProcessingSummary = {
  vendorId: string;
  vendorName: string;
  filename: string;
  format: string;
  processingStatus: string;
  parser: string;
  parserVersion: string;
  lastProcessedAt: string | null;
  aiExtractionRequired: boolean;
  warnings: string[];
  cacheHit: boolean;
};

const fixtureMap: Record<string, { filename: string; mimeType: string }> = {
  "vendor-a": {
    filename: "vendor-a.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  },
  "vendor-b": {
    filename: "vendor-b.pdf",
    mimeType: "application/pdf"
  },
  "vendor-c": {
    filename: "vendor-c.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  },
  "vendor-d": {
    filename: "vendor-d.txt",
    mimeType: "text/plain"
  },
  "vendor-e": {
    filename: "vendor-e.png",
    mimeType: "image/png"
  }
};

export async function processSeededVendorDocuments(): Promise<VendorDocumentProcessingSummary[]> {
  const cache = new ParserCache();
  const fixtureRoot = path.join(process.cwd(), "fixtures", "vendor-responses");

  return Promise.all(
    procurementEvent.vendors.map(async (vendor) => {
      const fixture = fixtureMap[vendor.id];
      const response = procurementEvent.responses.find((item) => item.vendorId === vendor.id);
      const bytes = await readFile(path.join(fixtureRoot, fixture.filename));
      const result = await processDocument({
        documentId: response?.documentId ?? `doc-${vendor.id}`,
        vendorId: vendor.id,
        rfxId: procurementEvent.rfx.id,
        filename: fixture.filename,
        mimeType: fixture.mimeType,
        bytes,
        cache,
        now: "2026-09-19T00:00:00.000Z"
      });

      return {
        vendorId: vendor.id,
        vendorName: vendor.name,
        filename: fixture.filename,
        format: result.parsedDocument.sourceType,
        processingStatus: result.parsedDocument.processingStatus,
        parser: result.parsedDocument.parserName,
        parserVersion: result.parsedDocument.parserVersion,
        lastProcessedAt: result.extractionRun.completedAt,
        aiExtractionRequired: result.parsedDocument.processingStatus === "EXTRACTION_REQUIRED",
        warnings: result.parsedDocument.warnings,
        cacheHit: result.cacheHit
      };
    })
  );
}
