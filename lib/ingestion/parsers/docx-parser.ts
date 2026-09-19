import mammoth from "mammoth";
import type { DocumentParser, ParsedRow, ParsedTable, SourceLocation } from "@/lib/ingestion/types";

export const docxParser: DocumentParser = {
  name: "mammoth-docx",
  version: "v1",
  supports: ["DOCX"],
  async parse({ metadata, bytes }) {
    const buffer = Buffer.from(bytes);
    const [rawText, html] = await Promise.all([
      mammoth.extractRawText({ buffer }),
      mammoth.convertToHtml({ buffer })
    ]);
    const paragraphs = rawText.value.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const tables = parseHtmlTables(html.value, metadata.documentId, metadata.contentHash);
    const sourceLocations = [
      ...paragraphs.map((paragraph, index) => sourceLocation(metadata.documentId, metadata.contentHash, `paragraph ${index + 1}`, paragraph)),
      ...tables.flatMap((table) => table.rows.flatMap((row) => row.cells.map((cell) => cell.location)))
    ];

    return {
      documentId: metadata.documentId,
      contentHash: metadata.contentHash,
      sourceType: "DOCX",
      parserName: docxParser.name,
      parserVersion: docxParser.version,
      processingStatus: "PARSED",
      extractedText: rawText.value,
      pages: [],
      tables,
      metadata: {
        paragraphCount: paragraphs.length,
        tableCount: tables.length
      },
      sourceLocations,
      warnings: rawText.messages.map((message) => message.message)
    };
  }
};

function parseHtmlTables(html: string, documentId: string, contentHash: string): ParsedTable[] {
  const tableMatches = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
  return tableMatches.map((tableHtml, tableIndex) => {
    const rowMatches = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
    const rows: ParsedRow[] = rowMatches.map((rowHtml, rowIndex) => {
      const cellMatches = rowHtml.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) ?? [];
      const cells = cellMatches.map((cellHtml, cellIndex) => {
        const value = stripHtml(cellHtml);
        const location = sourceLocation(documentId, contentHash, `table ${tableIndex + 1} row ${rowIndex + 1} column ${cellIndex + 1}`, value);
        return { value, location };
      });
      const location = sourceLocation(documentId, contentHash, `table ${tableIndex + 1} row ${rowIndex + 1}`, cells.map((cell) => cell.value).join(" | "));
      return { rowNumber: rowIndex + 1, cells, location };
    });

    return {
      tableId: `${documentId}-table-${tableIndex + 1}`,
      title: `DOCX table ${tableIndex + 1}`,
      rows,
      location: sourceLocation(documentId, contentHash, `table ${tableIndex + 1}`, `table ${tableIndex + 1}`)
    };
  });
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function sourceLocation(documentId: string, contentHash: string, location: string, text: string): SourceLocation {
  return {
    documentId,
    text,
    sourceLocation: location,
    parser: `${docxParser.name}-${docxParser.version}`,
    contentHash
  };
}
