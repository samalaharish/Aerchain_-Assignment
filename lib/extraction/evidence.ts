import type { ExtractionEvidence } from "@/lib/extraction/schemas";
import type { SourceLocation } from "@/lib/ingestion/types";

export function evidenceFromLocation(location: SourceLocation): ExtractionEvidence {
  return {
    documentId: location.documentId,
    text: location.text ?? location.sourceLocation,
    page: location.page,
    sheet: location.sheet,
    row: location.row,
    column: location.column,
    cell: location.cell,
    line: location.line,
    sourceLocation: location.sourceLocation,
    parser: location.parser,
    contentHash: location.contentHash
  };
}

export function fallbackEvidence(input: { documentId: string; contentHash: string; parser: string; text: string; sourceLocation?: string }): ExtractionEvidence {
  return {
    documentId: input.documentId,
    text: input.text,
    sourceLocation: input.sourceLocation ?? "document",
    parser: input.parser,
    contentHash: input.contentHash
  };
}
