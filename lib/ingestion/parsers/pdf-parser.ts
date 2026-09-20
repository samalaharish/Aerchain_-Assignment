import type { DocumentParser, ParsedPage, SourceLocation } from "@/lib/ingestion/types";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const pdfParser: DocumentParser = {
  name: "pdfjs-text",
  version: "v1",
  supports: ["PDF"],
  async parse({ metadata, bytes }) {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(path.join(process.cwd(), "runtime", "pdfjs", "pdf.worker.mjs")).href;
    const standardFontDataUrl = `${path.join(process.cwd(), "runtime", "pdfjs", "standard_fonts").replaceAll(path.sep, "/")}/`;
    const documentInit = {
      data: new Uint8Array(bytes),
      disableWorker: true,
      standardFontDataUrl
    } as unknown as Parameters<typeof pdfjs.getDocument>[0];
    const loadingTask = pdfjs.getDocument(documentInit);
    const pdf = await loadingTask.promise;
    const pages: ParsedPage[] = [];
    const sourceLocations: SourceLocation[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map((item) => ("str" in item ? item.str : ""))
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      const location = sourceLocation(metadata.documentId, metadata.contentHash, pageNumber, text);
      sourceLocations.push(location);
      pages.push({ pageNumber, text, location });
    }

    const extractedText = pages.map((page) => page.text).filter(Boolean).join("\n");
    const hasReadableText = extractedText.trim().length >= 20;

    return {
      documentId: metadata.documentId,
      contentHash: metadata.contentHash,
      sourceType: "PDF",
      parserName: pdfParser.name,
      parserVersion: pdfParser.version,
      processingStatus: hasReadableText ? "PARSED" : "EXTRACTION_REQUIRED",
      extractedText,
      pages,
      tables: [],
      metadata: {
        pageCount: pdf.numPages,
        readableTextCharacters: extractedText.length
      },
      sourceLocations,
      warnings: hasReadableText ? [] : ["PDF has insufficient machine-readable text and requires AI or OCR extraction."]
    };
  }
};

function sourceLocation(documentId: string, contentHash: string, page: number, text: string): SourceLocation {
  return {
    documentId,
    page,
    text,
    sourceLocation: `page ${page}`,
    parser: `${pdfParser.name}-${pdfParser.version}`,
    contentHash
  };
}
