import type { DocumentParser } from "@/lib/ingestion/types";

export const imageParser: DocumentParser = {
  name: "image-metadata",
  version: "v1",
  supports: ["PNG", "JPEG"],
  async parse({ metadata, bytes }) {
    return {
      documentId: metadata.documentId,
      contentHash: metadata.contentHash,
      sourceType: metadata.sourceType,
      parserName: imageParser.name,
      parserVersion: imageParser.version,
      processingStatus: "EXTRACTION_REQUIRED",
      extractedText: "",
      pages: [],
      tables: [],
      metadata: {
        byteLength: bytes.byteLength,
        mimeType: metadata.mimeType,
        note: "Image OCR is intentionally deferred to the AI/multimodal extraction goal."
      },
      sourceLocations: [],
      warnings: ["Image document requires OCR or multimodal extraction."]
    };
  }
};
