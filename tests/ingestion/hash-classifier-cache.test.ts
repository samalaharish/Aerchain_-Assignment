import { describe, expect, it } from "vitest";
import { classifyDocument } from "@/lib/ingestion/classifier";
import { ParserCache } from "@/lib/ingestion/cache";
import { createParserCacheKey, sha256 } from "@/lib/ingestion/hash";
import type { ParsedDocument } from "@/lib/ingestion/types";

describe("document hashing", () => {
  it("returns the same SHA-256 for the same bytes", () => {
    const bytes = new TextEncoder().encode("same vendor document");

    expect(sha256(bytes)).toBe(sha256(bytes));
  });

  it("returns different SHA-256 values for different bytes", () => {
    expect(sha256("vendor A")).not.toBe(sha256("vendor B"));
  });
});

describe("file classification", () => {
  it("classifies XLSX, PDF, DOCX, TXT, PNG, and JPG inputs", () => {
    expect(classifyDocument({ filename: "vendor-a.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes: zipBytes() }).sourceType).toBe("XLSX");
    expect(classifyDocument({ filename: "vendor-b.pdf", mimeType: "application/pdf", bytes: pdfBytes() }).sourceType).toBe("PDF");
    expect(classifyDocument({ filename: "vendor-c.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", bytes: zipBytes() }).sourceType).toBe("DOCX");
    expect(classifyDocument({ filename: "vendor-d.txt", mimeType: "text/plain", bytes: textBytes() }).sourceType).toBe("TXT");
    expect(classifyDocument({ filename: "vendor-e.png", mimeType: "image/png", bytes: pngBytes() }).sourceType).toBe("PNG");
    expect(classifyDocument({ filename: "vendor-e.jpg", mimeType: "image/jpeg", bytes: jpgBytes() }).sourceType).toBe("JPEG");
  });

  it("returns a structured error for unsupported files", () => {
    const result = classifyDocument({ filename: "vendor.exe", mimeType: "application/x-msdownload", bytes: textBytes() });

    expect(result.ok).toBe(false);
    expect(result.sourceType).toBe("UNSUPPORTED");
  });

  it("warns when extension and signature disagree", () => {
    const result = classifyDocument({ filename: "vendor-a.xlsx", mimeType: "application/pdf", bytes: pdfBytes() });

    expect(result.ok).toBe(true);
    expect(result.sourceType).toBe("PDF");
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe("parser cache", () => {
  it("detects duplicate document hashes", () => {
    const cache = new ParserCache();
    const hash = sha256("duplicate");

    expect(cache.registerDocumentHash(hash)).toBe(false);
    expect(cache.registerDocumentHash(hash)).toBe(true);
  });

  it("returns parser cache hits by parser name, version, and hash", () => {
    const cache = new ParserCache();
    const parsed = parsedDocument("v1");
    cache.set({ parserName: "text-lines", parserVersion: "v1", contentHash: parsed.contentHash, parsedDocument: parsed });

    expect(cache.get({ parserName: "text-lines", parserVersion: "v1", contentHash: parsed.contentHash })).toBe(parsed);
  });

  it("invalidates cache when parser version changes", () => {
    const cache = new ParserCache();
    const parsed = parsedDocument("v1");
    cache.set({ parserName: "text-lines", parserVersion: "v1", contentHash: parsed.contentHash, parsedDocument: parsed });

    expect(cache.get({ parserName: "text-lines", parserVersion: "v2", contentHash: parsed.contentHash })).toBeUndefined();
    expect(createParserCacheKey({ parserName: "text-lines", parserVersion: "v1", contentHash: parsed.contentHash })).not.toBe(
      createParserCacheKey({ parserName: "text-lines", parserVersion: "v2", contentHash: parsed.contentHash })
    );
  });
});

function parsedDocument(version: string): ParsedDocument {
  const contentHash = sha256("fixture");
  return {
    documentId: "doc-test",
    contentHash,
    sourceType: "TXT",
    parserName: "text-lines",
    parserVersion: version,
    processingStatus: "PARSED",
    extractedText: "hello",
    pages: [],
    tables: [],
    metadata: {},
    sourceLocations: [],
    warnings: []
  };
}

function zipBytes() {
  return new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
}

function pdfBytes() {
  return new Uint8Array([0x25, 0x50, 0x44, 0x46]);
}

function pngBytes() {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
}

function jpgBytes() {
  return new Uint8Array([0xff, 0xd8, 0xff]);
}

function textBytes() {
  return new TextEncoder().encode("plain text");
}
