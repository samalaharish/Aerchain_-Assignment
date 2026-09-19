import type { ParsedDocument } from "@/lib/ingestion/types";

export type ExtractionPath = "DETERMINISTIC" | "AI_PROVIDER";

export function decideExtractionPath(parsedDocument: ParsedDocument): {
  path: ExtractionPath;
  reason: string;
} {
  if (parsedDocument.sourceType === "XLSX" && parsedDocument.tables.length > 0 && parsedDocument.extractedText.includes("RFx Line")) {
    return { path: "DETERMINISTIC", reason: "Structured workbook includes RFx line identifiers and tabular quote fields." };
  }

  if (parsedDocument.sourceType === "PNG" || parsedDocument.sourceType === "JPEG") {
    return { path: "AI_PROVIDER", reason: "Image documents require multimodal interpretation." };
  }

  return { path: "AI_PROVIDER", reason: "Supplier response requires semantic interpretation or ambiguous RFx mapping." };
}
