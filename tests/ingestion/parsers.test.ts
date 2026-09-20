import { access, readFile } from "fs/promises";
import path from "path";
import { describe, expect, it } from "vitest";
import { ParserCache } from "@/lib/ingestion/cache";
import { processDocument } from "@/lib/ingestion/processor";
import { parsedDocumentSchema } from "@/lib/ingestion/schemas";

const fixtureRoot = path.join(process.cwd(), "fixtures", "vendor-responses");

describe("deterministic parsers", () => {
  it("parses Excel sheets, rows, cells, and source locations", async () => {
    const result = await processFixture("doc-a", "vendor-a", "vendor-a.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    expect(result.parsedDocument.parserName).toBe("sheetjs-workbook");
    expect(result.parsedDocument.tables[0].title).toBe("Commercial Quote");
    expect(result.parsedDocument.tables[0].rows[0].cells[0].location.sheet).toBe("Commercial Quote");
    expect(result.parsedDocument.extractedText).toContain("3-ply brown shipping carton");
  });

  it("parses DOCX paragraphs and tables", async () => {
    const result = await processFixture("doc-c", "vendor-c", "vendor-c.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

    expect(result.parsedDocument.parserName).toBe("mammoth-docx");
    expect(result.parsedDocument.extractedText).toContain("CartonCraft Works");
    expect(result.parsedDocument.tables.length).toBeGreaterThan(0);
    expect(result.parsedDocument.sourceLocations.some((location) => location.sourceLocation.includes("paragraph"))).toBe(true);
  });

  it("parses PDF text by page where machine-readable text exists", async () => {
    await expect(access(path.join(process.cwd(), "runtime", "pdfjs", "pdf.worker.mjs"))).resolves.toBeUndefined();
    let result: Awaited<ReturnType<typeof processFixture>>;
    try {
      result = await processFixture("doc-b", "vendor-b", "vendor-b.pdf", "application/pdf");
    } catch (error) {
      expect(error instanceof Error ? error.message : String(error)).not.toContain("Setting up fake worker failed");
      throw error;
    }

    expect(result.parsedDocument.parserName).toBe("pdfjs-text");
    expect(result.parsedDocument.processingStatus).toBe("PARSED");
    expect(result.parsedDocument.pages[0].pageNumber).toBe(1);
    expect(result.parsedDocument.extractedText).toContain("Bharat Corrugates");
  });

  it("parses TXT and preserves line information", async () => {
    const result = await processFixture("doc-d", "vendor-d", "vendor-d.txt", "text/plain");

    expect(result.parsedDocument.parserName).toBe("text-lines");
    expect(result.parsedDocument.tables[0].rows[0].location.line).toBe(1);
    expect(result.parsedDocument.extractedText).toContain("Delta Fibreboard");
  });

  it("marks images as extraction required without OCR", async () => {
    const result = await processFixture("doc-e", "vendor-e", "vendor-e.png", "image/png");

    expect(result.parsedDocument.parserName).toBe("image-metadata");
    expect(result.parsedDocument.processingStatus).toBe("EXTRACTION_REQUIRED");
    expect(result.extractionRun.status).toBe("AI_PENDING");
  });

  it("returns parser cache hit for unchanged documents", async () => {
    const cache = new ParserCache();
    const bytes = await readFile(path.join(fixtureRoot, "vendor-d.txt"));
    const input = {
      documentId: "doc-d",
      vendorId: "vendor-d",
      rfxId: "rfx-corrugated-2026",
      filename: "vendor-d.txt",
      mimeType: "text/plain",
      bytes,
      cache,
      now: "2026-09-19T00:00:00.000Z"
    };

    await processDocument(input);
    const second = await processDocument(input);

    expect(second.cacheHit).toBe(true);
  });
});

describe("parsed document validation", () => {
  it("accepts valid ParsedDocument output", async () => {
    const result = await processFixture("doc-d", "vendor-d", "vendor-d.txt", "text/plain");

    expect(parsedDocumentSchema.safeParse(result.parsedDocument).success).toBe(true);
  });

  it("rejects invalid ParsedDocument output", () => {
    const invalid = parsedDocumentSchema.safeParse({
      documentId: "",
      contentHash: "not-a-hash",
      sourceType: "TXT",
      parserName: "",
      parserVersion: "v1",
      processingStatus: "PARSED",
      extractedText: "text",
      pages: [],
      tables: [],
      metadata: {},
      sourceLocations: [],
      warnings: []
    });

    expect(invalid.success).toBe(false);
  });
});

async function processFixture(documentId: string, vendorId: string, filename: string, mimeType: string) {
  const bytes = await readFile(path.join(fixtureRoot, filename));
  return processDocument({
    documentId,
    vendorId,
    rfxId: "rfx-corrugated-2026",
    filename,
    mimeType,
    bytes,
    cache: new ParserCache(),
    now: "2026-09-19T00:00:00.000Z"
  });
}
