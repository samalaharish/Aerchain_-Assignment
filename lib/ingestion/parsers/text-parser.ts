import type { DocumentParser, ParsedDocument, ParsedRow, SourceLocation } from "@/lib/ingestion/types";

export const textParser: DocumentParser = {
  name: "text-lines",
  version: "v1",
  supports: ["TXT"],
  async parse({ metadata, bytes }) {
    const text = new TextDecoder("utf-8").decode(bytes);
    const lines = text.split(/\r?\n/);
    const sourceLocations: SourceLocation[] = [];
    const rows: ParsedRow[] = lines.map((line, index) => {
      const location = sourceLocation(metadata.documentId, metadata.contentHash, index + 1, line);
      sourceLocations.push(location);
      return {
        rowNumber: index + 1,
        cells: [{ value: line, location }],
        location
      };
    });

    return {
      documentId: metadata.documentId,
      contentHash: metadata.contentHash,
      sourceType: "TXT",
      parserName: textParser.name,
      parserVersion: textParser.version,
      processingStatus: "PARSED",
      extractedText: text,
      pages: [],
      tables: [
        {
          tableId: `${metadata.documentId}-lines`,
          title: "Text lines",
          rows,
          location: sourceLocation(metadata.documentId, metadata.contentHash, 1, lines[0] ?? "")
        }
      ],
      metadata: { lineCount: lines.length },
      sourceLocations,
      warnings: []
    };
  }
};

function sourceLocation(documentId: string, contentHash: string, line: number, text: string): SourceLocation {
  return {
    documentId,
    line,
    text,
    sourceLocation: `line ${line}`,
    parser: `${textParser.name}-${textParser.version}`,
    contentHash
  };
}
